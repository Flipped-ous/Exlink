import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Binary, ChevronDown, ChevronRight, CircleHelp, Command, FileClock, FolderOpen, Info, LayoutGrid, PanelRightClose, PanelRightOpen, Play, PlugZap, Power, Radio, RotateCcw, Settings, SlidersHorizontal, Square, TerminalSquare, Usb, Waves, X } from 'lucide-react';
import Terminal from './components/Terminal';
import Waveform from './components/Waveform';
import { ConnectionPopover, IconButton, SettingRow, Toggle } from './components/UI';
import { demoRows, makeEntry, sampleEntry } from './lib/demo';
import { deserializeLogs, toBytes, toText, type LogEntry } from './lib/log';
import { defaultPreferences, preferenceKey, readPreferences, type Preferences } from './lib/preferences';
import { SessionEngine, StreamDecoder, type Protocol, type SessionSnapshot } from './core/session';

type Tool = 'serial' | 'logic' | 'power' | 'tools' | 'settings';
const tools = [
  { id: 'serial' as const, title: '串口调试', icon: TerminalSquare },
  { id: 'logic' as const, title: '逻辑分析', icon: Binary },
  { id: 'power' as const, title: '智能电源', icon: Power },
  { id: 'tools' as const, title: '工具箱', icon: LayoutGrid },
];
const protocolLabels: Record<Protocol, string> = { 'key-value': '名称:数值', csv: 'CSV', 'just-float': 'JustFloat' };
export default function App() {
  const [tool, setTool] = useState<Tool>('serial'), [prefs, setPrefs] = useState<Preferences>(readPreferences);
  const [engine] = useState(() => new SessionEngine(demoRows()));
  const session = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [frozen, setFrozen] = useState<SessionSnapshot | null>(null), [demoRunning, setDemoRunning] = useState(false);
  const [source, setSource] = useState<'demo' | 'file'>('demo'), [filename, setFilename] = useState('');
  const [toast, setToast] = useState(''), [connectionOpen, setConnectionOpen] = useState(false);
  const [protocol, setProtocol] = useState<Protocol>('key-value'), [baud, setBaud] = useState('115200');
  const connectionTrigger = useRef<HTMLButtonElement>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notice = useCallback((message: string) => { clearTimeout(timer.current); setToast(message); timer.current = setTimeout(() => setToast(''), 4500); }, []);
  const patch = useCallback((value: Partial<Preferences>) => setPrefs(prev => ({ ...prev, ...value })), []);
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
    const id = setInterval(() => engine.append([sampleEntry((Date.now() - origin) / 1000)]), 100);
    return () => clearInterval(id);
  }, [demoRunning, engine]);
  const totals = useMemo(() => session.entries.reduce((n, entry) => { if (entry.direction === 'RX') n.rx += entry.bytes.length; if (entry.direction === 'TX') n.tx += entry.bytes.length; return n; }, { rx: 0, tx: 0 }), [session.entries]);
  const shown = frozen || session, waveVisible = prefs.wave && !prefs.waveCollapsed;
  const newer = frozen ? session.entries.filter(e => e.id > (frozen.entries.at(-1)?.id ?? 0)).length : 0;
  function loadDemo() { setDemoRunning(false); engine.setProtocol('key-value'); setProtocol('key-value'); engine.replace(demoRows()); setSource('demo'); setFilename(''); setFrozen(null); notice('四通道演示已就绪。'); }
  async function importLog(file: File) {
    if (file.size > 10 * 1024 * 1024) return notice('文件超过 10 MB，请分段导入。');
    try {
      const entries = deserializeLogs(await file.text()).map(entry => ({ ...entry, id: makeEntry('').id }));
      setDemoRunning(false); engine.replace(entries); setSource('file'); setFilename(file.name); setFrozen(null);
      notice(`已导入 ${entries.length.toLocaleString()} 条记录。`);
    } catch (error) { notice((error as Error).message); }
  }
  function send(bytes: number[]) {
    if (source !== 'demo') return;
    const command = toText(bytes).trim();
    const reply = command === 'status' ? '[INFO] demo=ON, hardware=DISCONNECTED\r\n' : command === 'help' ? '[DEMO] status / help — local simulator\r\n' : '[DEMO] command received\r\n';
    engine.append([{ ...makeEntry('', 'TX'), bytes }, makeEntry(reply)]);
  }
  function changeProtocol(next: Protocol) { engine.setProtocol(next); setProtocol(next); setFrozen(null); notice('已按新协议重新解析保留记录。'); }
  function toggleWave() { patch({ wave: true, waveCollapsed: waveVisible }); }
  function go(next: Tool) { setConnectionOpen(false); setTool(next); }
  const title = tools.find(t => t.id === tool)?.title || '设置';
  return <div className="app-shell">
    <a className="skip-link" href="#workspace">跳到工作区</a>
    <div className="ambient-light" aria-hidden="true"/>
    <aside className="activity-bar glass">
      <div className="brand-lockup" aria-label="EXLINK Studio"><img src="./brand/exlink-ribbon-dark-v3.png" width="48" height="48" alt=""/><strong>EXLINK</strong><span>Studio</span></div>
      <nav aria-label="主工具">{tools.map(({ id, title, icon: Icon }) => <button key={id} className={`nav-button ${tool === id ? 'active' : ''}`} onClick={() => go(id)} aria-current={tool === id ? 'page' : undefined}><Icon size={21} aria-hidden="true"/><span>{title}</span></button>)}</nav>
      <div className="rail-bottom"><span className="rail-device" title="硬件通信将在设备完成后适配"><span className="status-dot"/>未连接</span><button className={`nav-button ${tool === 'settings' ? 'active' : ''}`} onClick={() => go('settings')} aria-current={tool === 'settings' ? 'page' : undefined}><Settings size={21} aria-hidden="true"/><span>设置</span></button></div>
    </aside>
    <main className="main-area" id="workspace" tabIndex={-1}>
      <header className="workspace-heading"><div className="workspace-heading-title"><h1>{title}</h1><span className="session-label">{tool === 'serial' ? source === 'demo' ? '四通道信号' : filename : 'EXLINK Studio'}</span>{tool === 'serial' && <span className="demo-badge">{source === 'demo' ? '演示' : '离线'}</span>}</div><div className="heading-actions">{tool === 'serial' ? <><IconButton label="重新载入演示" onClick={loadDemo}><RotateCcw size={15}/></IconButton><button className={`quiet wave-toggle ${waveVisible ? 'selected' : ''}`} onClick={toggleWave} aria-expanded={waveVisible} aria-controls="waveform-panel">{waveVisible ? <PanelRightClose size={16}/> : <PanelRightOpen size={16}/>}<span>{waveVisible ? '收起波形' : '展开波形'}</span></button><button ref={connectionTrigger} className={`secondary ${connectionOpen ? 'selected' : ''}`} aria-controls="connection-popover" aria-expanded={connectionOpen} onClick={() => setConnectionOpen(!connectionOpen)}><Usb size={16}/>连接配置<ChevronDown size={13}/></button><button className={`primary ${demoRunning ? 'is-running' : ''}`} disabled={source !== 'demo'} onClick={() => setDemoRunning(!demoRunning)}>{demoRunning ? <Square size={13}/> : <Play size={14}/>}<span>{demoRunning ? '停止演示' : '运行演示'}</span></button></> : <span className="header-device"><Usb size={15}/>设备未连接</span>}</div></header>
      {tool === 'serial' ? <><div className={`serial-workspace ${waveVisible ? 'with-wave' : 'without-wave'}`}>
          <Terminal entries={shown.entries} paused={!!frozen} onPause={() => setFrozen(frozen ? null : session)} onClear={() => { engine.clearLogs(); setFrozen(prev => prev ? { ...prev, entries: [] } : null); }} onSend={send} onImport={importLog} dropped={session.dropped} newer={newer} showCommands={prefs.commands} onNotice={notice} source={source}/>
          {waveVisible && <Waveform frames={shown.samples} theme={prefs.theme} demo={source === 'demo'} hiddenChannels={prefs.hiddenChannels} channelUnits={prefs.channelUnits} onHiddenChange={hiddenChannels => patch({ hiddenChannels })} onCollapse={toggleWave} dropped={session.sampleDropped}/>}
        </div></> : tool === 'settings' ? <SettingsPage channelKeys={[...new Set(session.samples.flatMap(f => Object.keys(f.values)))].slice(0,32)} demo={source === 'demo'} prefs={prefs} patch={patch} protocol={protocol} onProtocol={changeProtocol} notice={notice}/> : tool === 'logic' ? <LogicPage/> : tool === 'power' ? <PowerPage notice={notice}/> : <Toolbox onSerial={() => go('serial')} notice={notice}/>}
      <footer className="status-bar"><span><span className="status-dot"/>硬件未连接</span><span className="status-note">{demoRunning ? '演示接收中' : source === 'file' ? '离线文件' : '本地演示'}</span><div className="status-spacer"/><span className="transfer-stat"><ArrowDownLeft size={12}/>RX {totals.rx.toLocaleString()} B</span><span className="transfer-stat"><ArrowUpRight size={12}/>TX {totals.tx.toLocaleString()} B</span><span title={session.lastParseIssue} className={session.parseErrors ? 'warning-text' : ''}>{session.parseErrors ? `解析异常 ${session.parseErrors}` : `${session.samples.length.toLocaleString()} 帧`}</span><IconButton label="快捷键提示" onClick={() => notice('Ctrl+F 搜索日志，Ctrl+Enter 发送，Ctrl+, 打开设置，Escape 关闭浮层。')}><CircleHelp size={14}/></IconButton></footer>
    </main>
    {connectionOpen && <ConnectionPopover trigger={connectionTrigger} onClose={() => setConnectionOpen(false)}><div className="connection-fields"><label className="field">数据源<select value={source} onChange={e => { if (e.target.value === 'demo') loadDemo(); }}><option value="demo">本地演示信号</option>{source === 'file' && <option value="file">{filename}</option>}<option disabled>硬件串口 · 待适配</option></select></label><div className="form-section-title">通信参数</div><label className="field">串口<select disabled><option>未连接硬件设备</option></select></label><div className="two-fields"><label className="field">波特率<select value={baud} onChange={e => setBaud(e.target.value)}>{['9600','115200','460800','921600'].map(value => <option key={value}>{value}</option>)}</select></label><label className="field">校验<select defaultValue="None"><option>None</option><option>Even</option><option>Odd</option></select></label></div><div className="two-fields"><label className="field">数据位<select defaultValue="8"><option>8</option><option>7</option></select></label><label className="field">停止位<select defaultValue="1"><option>1</option><option>2</option></select></label></div><div className="form-section-title">接收解析</div><label className="field">解析协议<select value={protocol} onChange={e => changeProtocol(e.target.value as Protocol)}><option value="key-value">名称:数值 · 逐行</option><option value="csv">CSV · 逐行</option><option value="just-float">JustFloat · 二进制</option></select></label><p className="hint">参数暂存于本地。设备完成后接入真实通信。</p><button className="secondary" disabled><PlugZap size={15}/>连接设备</button></div></ConnectionPopover>}
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
    {tab === 'about' && <div className="about-app"><img src="./brand/exlink-ribbon-dark-v3.png" width="88" height="88" alt="EXLINK 标志"/><h2>EXLINK Studio</h2><span>0.1.0 · UI 预览版</span><p>串口调试、多通道波形、逻辑分析与智能电源工作台。</p><p className="hint">当前提供本地演示与日志文件交互。硬件通信将在设备完成后适配。</p></div>}
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
