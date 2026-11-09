import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownToLine, ArrowUp, Check, ChevronDown, Copy, Download, Eraser, FileUp, Pause, Play, Search, X } from 'lucide-react';
import { matches, parseHex, serializeLogs, timestamp, toBytes, toHex, toText, type Direction, type LogEntry } from '../lib/log';
export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
type Props = { entries: LogEntry[]; paused: boolean; onPause: () => void; onClear: () => void; onSend: (bytes: number[]) => void; onImport: (file: File) => void; dropped: number; newer: number; showCommands: boolean; source: 'demo' | 'file'; onNotice: (s: string) => void };
export default function Terminal({ entries, paused, onPause, onClear, onSend, onImport, dropped, newer, showCommands, onNotice, source }: Props) {
  const scroll = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null), file = useRef<HTMLInputElement>(null);
  const [direction, setDirection] = useState<'ALL' | Direction>('ALL'), [query, setQuery] = useState('');
  const [format, setFormat] = useState<'text' | 'hex'>('text'), [follow, setFollow] = useState(true), [showTime, setShowTime] = useState(true);
  const [selected, setSelected] = useState<LogEntry | null>(null), [copied, setCopied] = useState(false);
  const [command, setCommand] = useState(''), [sendHex, setSendHex] = useState(false), [eol, setEol] = useState('\r\n'), [sendError, setSendError] = useState('');
  const [history, setHistory] = useState<string[]>([]), [historyOpen, setHistoryOpen] = useState(false);
  const filtered = useMemo(() => entries.filter(entry => matches(entry, { direction, query, format })), [entries, direction, query, format]);
  const rows = useVirtualizer({ count: filtered.length, getScrollElement: () => scroll.current, estimateSize: () => 24, overscan: 15 });
  useEffect(() => { if (follow && filtered.length) rows.scrollToIndex(filtered.length - 1, { align: 'end' }); }, [filtered.length, follow, rows]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); search.current?.focus(); } if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  function send() {
    if (!command.trim()) return;
    try {
      const bytes = sendHex ? parseHex(command) : toBytes(command + eol);
      onSend(bytes); setHistory(prev => [command, ...prev.filter(v => v !== command)].slice(0, 20)); setSendError('');
    } catch (e) { setSendError((e as Error).message); }
  }
  async function copySelected() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(format === 'hex' ? toHex(selected.bytes) : toText(selected.bytes)); setCopied(true); setTimeout(() => setCopied(false), 1200); }
    catch { onNotice('当前环境无法访问剪贴板，可在详情区选中文字复制。'); }
  }
  return <section className="panel terminal-panel glass" aria-label="收发日志">
    <header className="panel-header"><div className="panel-title"><h2>收发日志</h2> <span className="count">{entries.length.toLocaleString()}</span></div><div className="actions"><span className="log-view-status subtle">{paused ? `已暂停显示${newer > 0 ? ` · ${newer} 条新记录` : ''}` : '接收视图'}</span><button className={`icon-button ${paused ? 'selected' : ''}`} onClick={onPause} aria-label={paused ? '恢复数据显示' : '暂停数据显示'} title={paused ? '恢复显示' : '暂停日志和波形显示，接收继续'}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button><button className="icon-button" onClick={() => { onClear(); setSelected(null); }} aria-label="清空日志" title="清空日志"><Eraser size={14}/></button><button className="icon-button" onClick={() => downloadText('exlink-log.jsonl', serializeLogs(filtered), 'application/x-ndjson')} aria-label="导出筛选后的日志" title="导出当前筛选结果"><Download size={14}/></button><button className="icon-button" onClick={() => file.current?.click()} aria-label="导入日志" title="导入 JSONL 日志"><FileUp size={14}/></button><input ref={file} type="file" accept=".jsonl,.ndjson,.txt" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}/></div></header>
    <div className="log-toolbar"><div className="segment" aria-label="日志方向">{(['ALL', 'RX', 'TX', 'SYS'] as const).map(v => <button aria-pressed={direction === v} className={direction === v ? 'active' : ''} key={v} onClick={() => setDirection(v)}>{v === 'ALL' ? '全部' : v}</button>)}</div><select value={format} onChange={e => setFormat(e.target.value as 'text' | 'hex')} aria-label="日志显示格式"><option value="text">UTF-8</option><option value="hex">HEX</option></select><label className="search-field"><Search size={13}/><input ref={search} autoComplete="off" spellCheck={false} placeholder="筛选日志…" value={query} onChange={e => setQuery(e.target.value)} aria-label="筛选日志"/>{query && <button onClick={() => setQuery('')} aria-label="清除筛选"><X size={12}/></button>}</label><label className="inline-check"><input type="checkbox" checked={showTime} onChange={e => setShowTime(e.target.checked)}/>时间戳</label><button className={`follow-button ${follow ? 'active' : ''}`} onClick={() => setFollow(!follow)} aria-pressed={follow}><ArrowDownToLine size={13}/>跟随</button><span className="match-count">{filtered.length.toLocaleString()} 条</span></div>
    <div className={`log-columns ${showTime ? '' : 'no-time'}`}><span>时间</span><span>方向</span><span>数据</span><span>字节</span></div>
    <div className="log-scroll" ref={scroll} onScroll={() => { const el = scroll.current; if (el && follow && el.scrollHeight - el.clientHeight - el.scrollTop > 65) setFollow(false); }}>
      {filtered.length === 0 ? <div className="empty-log"><Search size={19}/><strong>{entries.length ? '没有匹配的记录' : '等待接收数据'}</strong><span>{entries.length ? '调整方向或搜索关键词' : '选择数据源，或加载一份演示记录'}</span></div> : <div style={{ height: rows.getTotalSize(), position: 'relative' }}>{rows.getVirtualItems().map(item => {
        const entry = filtered[item.index], text = toText(entry.bytes), level = text.includes('[WARN]') ? 'warning-row' : '';
        return <button className={`log-row ${showTime ? '' : 'no-time'} ${selected?.id === entry.id ? 'is-selected' : ''} ${level}`} key={entry.id} style={{ transform: `translateY(${item.start}px)` }} onClick={() => setSelected(selected?.id === entry.id ? null : entry)} aria-label={`${timestamp(entry.timestamp)} ${entry.direction} ${text}`}><time>{timestamp(entry.timestamp)}</time><span className={`direction ${entry.direction.toLowerCase()}`}>{entry.direction}</span><code>{format === 'hex' ? toHex(entry.bytes) : text.replace(/\r/g, '␍').replace(/\n/g, '␊')}</code><span className="byte-count">{entry.bytes.length}</span></button>;
      })}</div>}
    </div>
    {dropped > 0 && <div className="retention-note">显示缓冲已淘汰 {dropped.toLocaleString()} 条旧记录。导出仅包含当前保留的数据。</div>}
    {selected && <div className="packet-detail"><header><span>{timestamp(selected.timestamp)} · {selected.direction} · {selected.bytes.length} B · {selected.source === 'demo' ? '演示' : '导入文件'}</span><div className="actions"><button className="icon-button" onClick={copySelected} aria-label="复制选中记录">{copied ? <Check size={13}/> : <Copy size={13}/>}</button><button className="icon-button" onClick={() => setSelected(null)} aria-label="关闭记录详情"><X size={13}/></button></div></header><pre>{toText(selected.bytes)}</pre><code className="hex-detail">{toHex(selected.bytes)}</code></div>}
    <div className="send-area"><div className="send-meta"><strong>发送指令</strong><span className="target-label"><i/>{source === 'demo' ? '本地演示' : '离线文件 · 仅查看'}</span><div className="segment mini"><button className={!sendHex ? 'active' : ''} onClick={() => { setSendHex(false); setSendError(''); }}>文本</button><button className={sendHex ? 'active' : ''} onClick={() => { setSendHex(true); setSendError(''); }}>HEX</button></div><select aria-label="发送行尾" value={eol} onChange={e => setEol(e.target.value)} disabled={sendHex}><option value={'\r\n'}>CRLF</option><option value={'\n'}>LF</option><option value="">无行尾</option></select><div className="send-history"><button className="quiet" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>历史<ChevronDown size={12}/></button>{historyOpen && <div className="history-popover">{history.length ? history.map(v => <button key={v} onClick={() => { setCommand(v); setHistoryOpen(false); }}>{v}</button>) : <span>暂无发送记录</span>}</div>}</div></div><form className="send-form" onSubmit={e => { e.preventDefault(); send(); }}><textarea disabled={source === 'file'} spellCheck={false} autoComplete="off" rows={2} value={command} onChange={e => setCommand(e.target.value)} placeholder={sendHex ? 'AA 55 01 0D 0A' : '输入指令，Ctrl + Enter 发送'} aria-label="发送内容" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}/><button type="submit" className="primary" disabled={source === 'file'}><ArrowUp size={14}/>模拟发送</button></form>{sendError && <div className="error-text" role="alert">{sendError}</div>}{showCommands && <div className="quick-commands"><span>快捷指令</span>{['status', 'help', 'ping'].map(v => <button key={v} onClick={() => { setCommand(v); setSendHex(false); }}>{v}</button>)}</div>}</div>
  </section>;
}
