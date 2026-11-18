import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Binary, ChevronDown, ChevronRight, CircleHelp, Command, FileClock, FolderOpen, Info, LayoutGrid, PanelRightClose, PanelRightOpen, Play, PlugZap, Power, Radio, RotateCcw, Settings, SlidersHorizontal, Square, TerminalSquare, Usb, Waves, X } from 'lucide-react';
import Terminal from './components/Terminal';
import Waveform from './components/Waveform';
import { ConnectionPopover, IconButton, SettingRow, Toggle } from './components/UI';
import { demoRows, makeEntry, sampleEntry } from './lib/demo';
import { deserializeLogs, nextLogId, toBytes, toText, type LogSource } from './lib/log';
import { defaultPreferences, preferenceKey, readPreferences, type Preferences } from './lib/preferences';
import { baudRates, serialError, type SerialOptions } from './lib/serial';
import { SessionEngine, StreamDecoder, type Protocol, type SessionSnapshot } from './core/session';

type Tool = 'serial' | 'logic' | 'power' | 'tools' | 'settings';
const tools = [
  { id: 'serial' as const, title: '串口调试', icon: TerminalSquare },
  { id: 'logic' as const, title: '逻辑分析', icon: Binary },
  { id: 'power' as const, title: '智能电源', icon: Power },
  { id: 'tools' as const, title: '工具箱', icon: LayoutGrid },
];
const protocolLabels: Record<Protocol, string> = { 'key-value': '名称:数值', csv: 'CSV', 'just-float': 'JustFloat' };
type Connection = { id: number; path: string; phase: 'connecting' | 'connected' | 'closing' };

export default function App() {
  const [tool, setTool] = useState<Tool>('serial'), [prefs, setPrefs] = useState<Preferences>(readPreferences);
  const [engine] = useState(() => new SessionEngine(demoRows()));
  const session = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [frozen, setFrozen] = useState<SessionSnapshot | null>(null), [demoRunning, setDemoRunning] = useState(false);
  const [source, setSource] = useState<LogSource>('demo'), [sourceName, setSourceName] = useState('');
  const [toast, setToast] = useState(''), [connectionOpen, setConnectionOpen] = useState(false);
  const [protocol, setProtocol] = useState<Protocol>('key-value');
  const [serialOptions, setSerialOptions] = useState<SerialOptions>({
    path: '', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none',
  });
  const [ports, setPorts] = useState<string[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const currentConnection = useRef<Connection | null>(null);
  const nextConnectionId = useRef(0);
  const sourceRevision = useRef(0);
  const portRefresh = useRef(0);
  const bridge = window.exlinkSerial;
  const connectionTrigger = useRef<HTMLButtonElement>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notice = useCallback((message: string) => { clearTimeout(timer.current); setToast(message); timer.current = setTimeout(() => setToast(''), 4500); }, []);
  const patch = useCallback((value: Partial<Preferences>) => setPrefs(prev => ({ ...prev, ...value })), []);
  const changeConnection = useCallback((value: Connection | null) => {
    currentConnection.current = value;
    setConnection(value);
  }, []);
  const refreshPorts = useCallback(async (reportError = false) => {
    if (!bridge) return;
    const revision = ++portRefresh.current;
    try {
      const available = await bridge.list();
      if (revision !== portRefresh.current) return;
      setPorts(available);
      if (!currentConnection.current) {
        setSerialOptions(options => ({ ...options, path: available.includes(options.path) ? options.path : available[0] ?? '' }));
      }
    } catch (error) {
      if (revision === portRefresh.current && reportError) notice(serialError(error));
    }
  }, [bridge, notice]);
  useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.onEvent(event => {
      const current = currentConnection.current;
      if (!current || current.id !== event.id) return;
      if (event.type === 'opened') {
        changeConnection({ ...current, phase: 'connected' });
        clearTimeout(timer.current);
        setToast('');
        setDemoRunning(false);
        setSource('serial');
        setSourceName(current.path);
        setFrozen(null);
        engine.replace([]);
      } else if (event.type === 'closed') {
        changeConnection(null);
        if (event.error) {
          setConnectionError(event.error);
          notice(event.error);
        }
        void refreshPorts();
      } else {
        engine.append(event.records.map(record => ({ ...record, id: nextLogId(), source: 'serial', bytes: Array.from(record.bytes) })));
      }
    });
    const refreshOnFocus = () => void refreshPorts();
    window.addEventListener('focus', refreshOnFocus);
    void refreshPorts();
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [bridge, changeConnection, engine, notice, refreshPorts]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme; document.documentElement.dataset.glass = String(prefs.glass);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', prefs.theme === 'dark' ? '#101018' : '#e8e8f2');
    try { localStorage.setItem(preferenceKey, JSON.stringify(prefs)); } catch { /* Local storage is optional. */ }
  }, [prefs]);
  useEffect(() => {
    function key(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); setConnectionOpen(false); setTool('settings'); } }
    window.addEventListener('keydown', key); return () => { window.removeEventListener('keydown', key); clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!demoRunning) return;
    const origin = Date.now() - 10000;
    const id = setInterval(() => {
      if (currentConnection.current?.phase !== 'connected') engine.append([sampleEntry((Date.now() - origin) / 1000)]);
    }, 100);
    return () => clearInterval(id);
  }, [demoRunning, engine]);
  const totals = useMemo(() => session.entries.reduce((n, entry) => { if (entry.direction === 'RX') n.rx += entry.bytes.length; if (entry.direction === 'TX') n.tx += entry.bytes.length; return n; }, { rx: 0, tx: 0 }), [session.entries]);
  const shown = frozen || session, waveVisible = prefs.wave && !prefs.waveCollapsed;
  const newer = frozen ? session.entries.filter(e => e.id > (frozen.entries.at(-1)?.id ?? 0)).length : 0;
  async function openSerial() {
    if (!bridge || Boolean(currentConnection.current) || !serialOptions.path) return;
    sourceRevision.current++;
    const attempt: Connection = { id: ++nextConnectionId.current, path: serialOptions.path, phase: 'connecting' };
    changeConnection(attempt);
    setConnectionError('');
    setConnectionOpen(false);
    try {
      await bridge.open(attempt.id, serialOptions);
    } catch (error) {
      if (currentConnection.current?.id !== attempt.id) return;
      changeConnection(null);
      setConnectionError(serialError(error));
      notice(serialError(error));
      void refreshPorts();
    }
  }
  async function closeSerial() {
    const current = currentConnection.current;
    if (!bridge || current?.phase !== 'connected') return;
    changeConnection({ ...current, phase: 'closing' });
    try {
      await bridge.close(current.id);
    } catch (error) {
      if (currentConnection.current?.id === current.id) changeConnection(current);
      notice(serialError(error));
    }
  }
  function loadDemo() {
    if (currentConnection.current) return;
    sourceRevision.current++;
    setDemoRunning(false);
    engine.setProtocol('key-value');
    setProtocol('key-value');
    engine.replace(demoRows());
    setSource('demo');
    setSourceName('');
    setFrozen(null);
    notice('四通道演示已就绪。');
  }
  async function importLog(file: File) {
    if (currentConnection.current) return;
    if (file.size > 10 * 1024 * 1024) return notice('文件超过 10 MB，请分段导入。');
    const revision = ++sourceRevision.current;
    try {
      const data = await file.text();
      if (revision !== sourceRevision.current) return;
      const entries = deserializeLogs(data).map(entry => ({ ...entry, id: nextLogId() }));
      setDemoRunning(false); engine.replace(entries); setSource('file'); setSourceName(file.name); setFrozen(null);
      notice(`已导入 ${entries.length.toLocaleString()} 条记录。`);
    } catch (error) { if (revision === sourceRevision.current) notice((error as Error).message); }
  }
  async function send(bytes: number[]) {
    if (source === 'serial' && bridge && currentConnection.current?.phase === 'connected') {
      try { await bridge.send(currentConnection.current.id, Uint8Array.from(bytes)); }
      catch (error) { throw new Error(serialError(error)); }
      return;
    }
    if (source !== 'demo' || currentConnection.current) throw new Error('请先连接串口。');
    const command = toText(bytes).trim();
    const reply = command === 'status' ? '[INFO] demo=ON, hardware=DISCONNECTED\r\n' : command === 'help' ? '[DEMO] status / help — local simulator\r\n' : '[DEMO] command received\r\n';
    engine.append([{ ...makeEntry('', 'TX'), bytes }, makeEntry(reply)]);
  }
  function changeProtocol(next: Protocol) { engine.setProtocol(next); setProtocol(next); setFrozen(null); notice('已按新协议重新解析保留记录。'); }
  function toggleWave() { patch({ wave: true, waveCollapsed: waveVisible }); }
  function go(next: Tool) { setConnectionOpen(false); setTool(next); }
  const title = tools.find(t => t.id === tool)?.title || '设置';
  const connected = connection?.phase === 'connected';
  const serialStatus = connected ? '已连接'
    : connection?.phase === 'connecting' ? '连接中'
    : connection?.phase === 'closing' ? '断开中'
    : connectionError ? source === 'serial' ? '连接异常' : '连接失败' : '未连接';
  const statusDot = `status-dot${connected ? ' connected' : connectionError ? ' failed' : ''}`;
  const selectedPort = connection?.path ?? serialOptions.path;
  const sourceLabel = source === 'demo' ? '本地演示' : source === 'file' ? '离线文件' : `${sourceName} · 真实串口`;
  return <div className="app-shell">
    <a className="skip-link" href="#workspace">跳到工作区</a>
    <div className="ambient-light" aria-hidden="true"/>
    <aside className="activity-bar glass">
      <div className="brand-lockup" aria-label="EXLINK Studio"><img src="./brand/exlink-ribbon-dark-v3.png" width="48" height="48" alt=""/><strong>EXLINK</strong><span>Studio</span></div>
      <nav aria-label="主工具">{tools.map(({ id, title, icon: Icon }) => <button key={id} className={`nav-button ${tool === id ? 'active' : ''}`} onClick={() => go(id)} aria-current={tool === id ? 'page' : undefined}><Icon size={21} aria-hidden="true"/><span>{title}</span></button>)}</nav>
      <div className="rail-bottom"><span className="rail-device"><span className={statusDot}/>{serialStatus}</span><button className={`nav-button ${tool === 'settings' ? 'active' : ''}`} onClick={() => go('settings')} aria-current={tool === 'settings' ? 'page' : undefined}><Settings size={21} aria-hidden="true"/><span>设置</span></button></div>
    </aside>
    <main className="main-area" id="workspace" tabIndex={-1}>
      <header className="workspace-heading">
        <div className="workspace-heading-title">
          <h1>{title}</h1>
          {tool === 'serial' && source !== 'serial' && <span className="demo-badge" title={sourceName || undefined}>{source === 'demo' ? '演示' : '离线'}</span>}
        </div>
        <div className="heading-actions">
          {tool === 'serial' ? <>
            {!connection && <IconButton label={source === 'demo' ? '重新载入演示' : '载入演示'} onClick={loadDemo}><RotateCcw size={15}/></IconButton>}
            {source === 'demo' && !connection && <button className={`quiet demo-run ${demoRunning ? 'selected' : ''}`} onClick={() => setDemoRunning(!demoRunning)}>
              {demoRunning ? <Square size={13}/> : <Play size={14}/>}<span>{demoRunning ? '停止演示' : '运行演示'}</span>
            </button>}
            <button className={`quiet wave-toggle ${waveVisible ? 'selected' : ''}`} onClick={toggleWave} aria-label={waveVisible ? '收起波形' : '展开波形'} aria-expanded={waveVisible} aria-controls="waveform-panel">
              {waveVisible ? <PanelRightClose size={16}/> : <PanelRightOpen size={16}/>}<span>{waveVisible ? '收起波形' : '展开波形'}</span>
            </button>
            <div className="serial-controls">
              <select aria-label="串口" value={selectedPort} disabled={!bridge || !!connection || !ports.length}
                onChange={e => { setSerialOptions({ ...serialOptions, path: e.target.value }); setConnectionError(''); }}>
                {!selectedPort && <option value="">{bridge ? '无可用串口' : '桌面串口'}</option>}
                {selectedPort && !ports.includes(selectedPort) && <option value={selectedPort}>{selectedPort}</option>}
                {ports.map(port => <option key={port}>{port}</option>)}
              </select>
              <select aria-label="波特率" value={serialOptions.baudRate} disabled={!bridge || !!connection}
                onChange={e => setSerialOptions({ ...serialOptions, baudRate: Number(e.target.value) })}>
                {baudRates.map(rate => <option key={rate}>{rate}</option>)}
              </select>
              <button ref={connectionTrigger} className={`secondary ${connectionOpen ? 'selected' : ''}`} aria-controls="connection-popover" aria-expanded={connectionOpen}
                onClick={() => { if (!connectionOpen) void refreshPorts(); setConnectionOpen(!connectionOpen); }}>
                <SlidersHorizontal size={14}/>连接配置
              </button>
              <button className={connected ? 'secondary' : 'primary'} disabled={!bridge || (!connected && (!!connection || !selectedPort))}
                onClick={() => void (connected ? closeSerial() : openSerial())}>
                <PlugZap size={14}/>{connected ? '断开' : '连接串口'}
              </button>
              <span className={`serial-status ${connectionError ? 'error-text' : ''}`} aria-live="polite" title={connectionError || undefined}>
                <span className={statusDot}/>{serialStatus}
              </span>
            </div>
          </> : <span className="header-device"><Usb size={15}/>设备未连接</span>}
        </div>
      </header>
      {tool === 'serial' ? <><div className={`serial-workspace ${waveVisible ? 'with-wave' : 'without-wave'}`}>
          <Terminal entries={shown.entries} epoch={shown.epoch} paused={!!frozen} onPause={() => setFrozen(frozen ? null : session)} onClear={() => { engine.clearLogs(); setFrozen(prev => prev ? { ...prev, entries: [] } : null); }} onSend={send} onImport={importLog} dropped={session.dropped} newer={newer} showCommands={prefs.commands && source === 'demo'} onNotice={notice} source={source} sourceLabel={sourceLabel} canSend={source === 'demo' ? !connection : connected} canImport={!connection}/>
          {waveVisible && <Waveform key={shown.epoch} frames={shown.samples} theme={prefs.theme} demo={source === 'demo'} hiddenChannels={prefs.hiddenChannels} channelUnits={prefs.channelUnits} onHiddenChange={hiddenChannels => patch({ hiddenChannels })} onCollapse={toggleWave} dropped={session.sampleDropped}/>}
        </div></> : tool === 'settings' ? <SettingsPage channelKeys={[...new Set(session.samples.flatMap(f => Object.keys(f.values)))].slice(0,32)} demo={source === 'demo'} prefs={prefs} patch={patch} protocol={protocol} onProtocol={changeProtocol} notice={notice}/> : tool === 'logic' ? <LogicPage/> : tool === 'power' ? <PowerPage notice={notice}/> : <Toolbox onSerial={() => go('serial')} notice={notice}/>}
      <footer className="status-bar"><span title={sourceName || undefined}>{demoRunning ? '演示接收中' : sourceLabel}</span><div className="status-spacer"/><span className="transfer-stat"><ArrowDownLeft size={12}/>RX {totals.rx.toLocaleString()} B</span><span className="transfer-stat"><ArrowUpRight size={12}/>TX {totals.tx.toLocaleString()} B</span><span title={session.lastParseIssue || ''} className={session.parseErrors ? 'warning-text' : ''}>{session.parseErrors ? `解析异常 ${session.parseErrors}` : `${session.samples.length.toLocaleString()} 帧`}</span><IconButton label="快捷键提示" onClick={() => notice('Ctrl+F 搜索日志，Ctrl+Enter 发送，Ctrl+, 打开设置，Escape 关闭浮层。')}><CircleHelp size={14}/></IconButton></footer>
    </main>
    {connectionOpen && <ConnectionPopover trigger={connectionTrigger} onClose={() => setConnectionOpen(false)}>
      <div className="connection-fields">
        <div className="two-fields">
          <label className="field">数据位<select disabled={!!connection} value={serialOptions.dataBits} onChange={e => setSerialOptions({ ...serialOptions, dataBits: Number(e.target.value) as 7 | 8 })}><option>8</option><option>7</option></select></label>
          <label className="field">停止位<select disabled={!!connection} value={serialOptions.stopBits} onChange={e => setSerialOptions({ ...serialOptions, stopBits: Number(e.target.value) as 1 | 2 })}><option>1</option><option>2</option></select></label>
        </div>
        <label className="field">校验<select disabled={!!connection} value={serialOptions.parity} onChange={e => setSerialOptions({ ...serialOptions, parity: e.target.value as SerialOptions['parity'] })}><option value="none">无校验</option><option value="even">偶校验</option><option value="odd">奇校验</option></select></label>
        <label className="field">解析协议<select value={protocol} onChange={e => changeProtocol(e.target.value as Protocol)}><option value="key-value">名称:数值 · 逐行</option><option value="csv">CSV · 逐行</option><option value="just-float">JustFloat · 二进制</option></select></label>
        {connection && <p className="hint">断开串口后可更改通信参数。</p>}
        {bridge && !connection && <button className="secondary" onClick={() => void refreshPorts(true)}><RotateCcw size={14}/>刷新串口列表</button>}
      </div>
    </ConnectionPopover>}
    {toast && <div className="toast glass" role="status"><Info size={17}/><span>{toast}</span><IconButton label="关闭提示" onClick={() => setToast('')}><X size={15}/></IconButton></div>}
  </div>;
}

function SettingsPage({ prefs, patch, protocol, onProtocol, notice, channelKeys, demo }: { prefs: Preferences; patch: (p: Partial<Preferences>) => void; protocol: Protocol; onProtocol: (p: Protocol) => void; notice: (s: string) => void; channelKeys: string[]; demo: boolean }) {
  const [tab, setTab] = useState('appearance'), [sample, setSample] = useState('CH1:2.50,CH2:1.80,CH3:3.20,CH4:2.10');
  const [result, setResult] = useState<[string, number][]>([]), [error, setError] = useState('');
  function preview() { const parsed = new StreamDecoder().feed(toBytes(sample + '\n'), Date.now()); setResult(Object.entries(parsed.frames[0]?.values || {})); setError(parsed.issues[0] || (parsed.frames.length ? '' : '请输入“名称:数值”，以逗号分隔。')); }
  const labels: Record<string, string> = { appearance: '外观', workspace: '调试工作区', data: '数据与解析', about: '关于' };
  return <section className="settings-page glass"><nav className="settings-categories" aria-label="设置分类">{[{id:'appearance',icon:SlidersHorizontal},{id:'workspace',icon:LayoutGrid},{id:'data',icon:FileClock},{id:'about',icon:Info}].map(({id,icon:Icon}) => <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={17}/>{labels[id]}<ChevronRight size={13}/></button>)}</nav><div className="settings-content"><h2>{labels[tab]}</h2><p className="page-description">{tab === 'appearance' ? '让工作台适应你的工作环境。' : tab === 'workspace' ? '选择调试时需要的视图和操作。' : tab === 'data' ? '查看数据的解析方式与保留范围。' : '为嵌入式开发而设计。'}</p>
    {tab === 'appearance' && <><div className="theme-previews"><button className={`theme-preview dark-preview ${prefs.theme === 'dark' ? 'chosen' : ''}`} onClick={() => patch({theme:'dark'})} aria-pressed={prefs.theme === 'dark'}><span className="mini-window"><i/><b/><em/></span><span>深色 <small>夜间工作台</small></span></button><button className={`theme-preview light-preview ${prefs.theme === 'light' ? 'chosen' : ''}`} onClick={() => patch({theme:'light'})} aria-pressed={prefs.theme === 'light'}><span className="mini-window"><i/><b/><em/></span><span>浅色 <small>明亮工作环境</small></span></button></div><SettingRow title="液态玻璃" description="通透表面、流动高光与层叠材质"><Toggle label="液态玻璃" checked={prefs.glass} onChange={glass => patch({glass})}/></SettingRow><SettingRow title="界面字体" description="界面与数据使用各自适合的字体"><span className="subtle">系统字体 / 等宽数据字体</span></SettingRow></>}
    {tab === 'workspace' && <><SettingRow title="串口波形" description="在日志旁显示多通道波形，可随时收起"><Toggle label="启用串口波形" checked={prefs.wave} onChange={wave => patch({wave, waveCollapsed: !wave})}/></SettingRow><SettingRow title="快捷指令" description="在发送区显示常用指令"><Toggle label="显示快捷指令" checked={prefs.commands} onChange={commands => patch({commands})}/></SettingRow><SettingRow title="通道显示" description="恢复所有通道的可见状态"><button className="secondary" onClick={() => { patch({hiddenChannels:[]}); notice('所有通道已设为可见。'); }}>显示全部通道</button></SettingRow><button className="quiet reset-preferences" onClick={() => { patch({...defaultPreferences,hiddenChannels:[]}); notice('已恢复默认设置。'); }}><RotateCcw size={14}/>恢复默认设置</button></>}
    {tab === 'data' && <><SettingRow title="接收解析协议" description="更改后从当前保留的原始字节重建波形"><select value={protocol} onChange={e => onProtocol(e.target.value as Protocol)}>{Object.entries(protocolLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></SettingRow><SettingRow title="数据保留" description="达到上限后淘汰最早数据，原始日志与曲线独立保留"><span>5,000 条日志 / 20,000 帧</span></SettingRow><h3>通道单位</h3><p className="hint">不同单位分组显示，设置仅用于图表标注，不换算数值。</p><div className="unit-settings">{channelKeys.map(key => <label className="field" key={key}>{key}<select aria-label={`通道 ${key} 单位`} value={Object.hasOwn(prefs.channelUnits,key) ? prefs.channelUnits[key] : (demo && /^CH[1-4]$/.test(key) ? 'V' : '数值')} onChange={e => patch({channelUnits:{...prefs.channelUnits,[key]:e.target.value}})}>{['数值','V','A','RPM','°C','Hz'].map(unit => <option key={unit}>{unit}</option>)}</select></label>)}</div><h3>名称:数值解析预览</h3><p className="hint">使用与接收数据相同的解析器，不发送到设备。</p><div className="parse-form"><label className="field">样例帧<input value={sample} onChange={e => setSample(e.target.value)} autoComplete="off" spellCheck={false}/></label><button className="primary" onClick={preview}>预览解析</button></div>{error && <p className="error-text" role="alert">{error}</p>}{result.length > 0 && <table className="data-table"><thead><tr><th>通道</th><th>数值</th></tr></thead><tbody>{result.map(([key,value]) => <tr key={key}><td>{key}</td><td>{value}</td></tr>)}</tbody></table>}</>}
    {tab === 'about' && <div className="about-app"><img src="./brand/exlink-ribbon-dark-v3.png" width="88" height="88" alt="EXLINK 标志"/><h2>EXLINK Studio</h2><span>0.1.0 · Windows 调试助手</span><p>串口调试、多通道波形、逻辑分析与智能电源工作台。</p><p className="hint">支持 Windows COM 串口、本地演示和 JSONL 回放。</p></div>}
  </div></section>;
}
function LogicPage() {
  const [channels, setChannels] = useState(Array(8).fill(true)), [trigger, setTrigger] = useState('rising');
  return <section className="tool-page glass"><div className="tool-intro"><div><h2>数字信号采集</h2><p>八路通道，共同时间轴。</p></div><span className="neutral-badge"><Usb size={14}/>等待设备</span></div><div className="logic-toolbar"><label>采样配置<select disabled><option>连接设备后读取</option></select></label><label>触发方式<select value={trigger} onChange={e => setTrigger(e.target.value)}><option value="rising">上升沿</option><option value="falling">下降沿</option><option value="either">任意边沿</option></select></label><button className="primary" disabled><Play size={14}/>开始采集</button></div><div className="logic-timeline">{channels.map((checked,i) => <div className="logic-lane" key={i}><label><input type="checkbox" checked={checked} onChange={e => setChannels(prev => prev.map((v,n) => n === i ? e.target.checked : v))}/><span className={`channel-dot color-${i}`}/>D{i}</label><div className={checked ? '' : 'muted-lane'}><span>—</span></div></div>)}<div className="timeline-empty"><Binary size={28}/><strong>连接设备，开始观察数字信号</strong><span>采样率和输入范围将在连接后显示</span></div></div><div className="tool-footnote"><Info size={15}/>当前仅预览界面，尚无真实采样数据。</div></section>;
}
function PowerPage({ notice }: { notice: (s:string) => void }) {
  const [voltage, setVoltage] = useState('3.3');
  return <section className="tool-page power-page glass"><div className="tool-intro"><div><h2>输出工作台</h2><p>VOUT / GND</p></div><span className="neutral-badge"><span className="status-dot"/>输出状态未知</span></div><div className="power-layout"><div className="power-instrument"><div className="instrument-title"><Power size={19}/><span>实际输出</span><span className="subtle">未连接</span></div><div className="power-reading-main"><span>输出电压</span><strong>—<small>V</small></strong></div><div className="power-reading-pair"><div><span>输出电流</span><strong>— <small>A</small></strong></div><div><span>输出功率</span><strong>— <small>W</small></strong></div></div><div className="power-trend-empty"><Activity size={26}/><span>连接后显示输出趋势</span></div></div><div className="power-controls"><h3>输出设定</h3><label className="field">目标电压<div className="voltage-input"><input type="number" inputMode="decimal" min="3.3" max="20" step="0.1" value={voltage} onChange={e => setVoltage(e.target.value)}/><span>V</span></div></label><div className="voltage-presets">{['3.3','5','9','12'].map(v => <button key={v} className={voltage === v ? 'selected' : ''} onClick={() => setVoltage(v)}>{v} V</button>)}</div><p className="hint">3.3–20 V 为设计目标，实际范围与功率以设备验证结果为准。</p><button className="primary" disabled><Power size={15}/>开启输出</button><div className="inline-note"><Info size={16}/><span>连接设备后才能操作输出。当前设定仅保留在此页面。</span></div><button className="quiet" onClick={() => notice('设定值与实际读数独立显示。硬件输出功能将在设备完成后接入。')}>查看输出说明<ChevronRight size={13}/></button></div></div></section>;
}
function Toolbox({ onSerial, notice }: { onSerial: () => void; notice: (s:string) => void }) {
  return <section className="tool-page glass"><div className="tool-intro"><div><h2>调试工具箱</h2><p>将常用辅助操作放在一起。</p></div></div><div className="toolbox-list"><button onClick={onSerial}><FileClock size={24}/><div><strong>日志文件查看</strong><span>导入 JSONL，筛选记录并查看原始字节</span></div><span className="tool-availability">可使用</span><ChevronRight size={18}/></button><button onClick={() => notice('网络调试将在后续版本中加入。')}><Radio size={24}/><div><strong>网络调试</strong><span>TCP / UDP 会话</span></div><span className="tool-availability planned">规划中</span><ChevronRight size={18}/></button><button onClick={() => notice('图像调试将在后续版本中加入。')}><FolderOpen size={24}/><div><strong>图像调试</strong><span>图像流与帧数据查看</span></div><span className="tool-availability planned">规划中</span><ChevronRight size={18}/></button></div><div className="toolbox-note"><Command size={16}/><span>Ctrl + F 搜索日志</span><span>Ctrl + Enter 发送</span><span>Ctrl + , 打开设置</span></div></section>;
}
