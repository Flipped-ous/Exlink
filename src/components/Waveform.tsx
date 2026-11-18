import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Check, Crosshair, Maximize2, PanelRightClose, Waves } from 'lucide-react';
import { minMaxWindow, type SampleFrame } from '../core/session';
import { buildTimeline, followLatest, keepInBuffer, plotIndex, zoomRange, type PlotRange } from '../core/waveform';
import { IconButton } from './UI';

type Props = { frames: SampleFrame[]; theme: string; demo: boolean; hiddenChannels: string[]; channelUnits: Record<string,string>; onHiddenChange: (keys: string[]) => void; onCollapse: () => void; dropped: number };
const demoNames: Record<string,string> = { CH1: '主信号', CH2: '相移信号', CH3: '复合信号', CH4: '调制信号', target:'目标转速',speed:'实际转速',current:'电流',voltage:'电压' };
function unitFor(key:string,demo:boolean) { if (!demo) return '数值'; return /^CH[1-4]$/.test(key) || key==='voltage' ? 'V' : key==='current' ? 'A' : key==='target'||key==='speed' ? 'RPM' : '数值'; }
export default function Waveform({ frames, theme, demo, hiddenChannels, channelUnits, onHiddenChange, onCollapse, dropped }: Props) {
  const host = useRef<HTMLDivElement>(null), plot = useRef<uPlot | null>(null);
  const [cursor, setCursor] = useState(true), [span, setSpan] = useState(10), [width, setWidth] = useState(500), [group, setGroup] = useState('V');
  const [manualX, setManualX] = useState<PlotRange | null>(null);
  const [manualY, setManualY] = useState<PlotRange | null>(null);
  const [readout, setReadout] = useState<SampleFrame | null>(null);
  const origin = useRef<number | null>(null);
  const timeline = useMemo(() => {
    if (origin.current === null && frames.length) {
      origin.current = frames.reduce((time, frame) => Math.min(time, frame.timestamp), frames[0].timestamp);
    }
    return buildTimeline(frames, origin.current ?? 0);
  }, [frames]);
  const available = useMemo(() => [...new Set(frames.flatMap(f => Object.keys(f.values)))].slice(0,32), [frames]);
  const groups: string[] = [...new Set(available.map(key => (Object.hasOwn(channelUnits,key) ? channelUnits[key] : unitFor(key,demo))))];
  const selectedGroup = groups.includes(group) ? group : groups[0];
  const keys = available.filter(key => (Object.hasOwn(channelUnits,key) ? channelUnits[key] : unitFor(key,demo)) === selectedGroup), signature = keys.join('|');
  const visible = keys.filter(key => !hiddenChannels.includes(key)), visibleSignature = visible.join('|');
  const xRange = manualX ? keepInBuffer(manualX, timeline) : followLatest(timeline, span);
  const first = plotIndex(timeline, xRange.min);
  const end = plotIndex(timeline, xRange.max, true);
  const data = useMemo<uPlot.AlignedData>(() => {
    // Keep one adjacent point on each side so segments crossing a viewport edge are clipped by the chart.
    const window = timeline.slice(Math.max(0, first - 1), end + 1);
    const display = minMaxWindow(window, visible, Math.max(64, Math.floor(width)));
    return [display.map(frame => frame.x), ...keys.map(key => display.map(frame => Number.isFinite(frame.values[key]) ? frame.values[key] : null))];
  }, [timeline, first, end, width, signature, visibleSignature]);
  const ranges = useMemo(() => Object.fromEntries(keys.map(key => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = first; i < end; i++) {
      const value = timeline[i].values[key];
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return [key, min <= max ? { min, max } : null];
  })), [timeline, first, end, signature]);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const key of visible) {
    if (ranges[key]) {
      minY = Math.min(minY, ranges[key].min);
      maxY = Math.max(maxY, ranges[key].max);
    }
  }
  const [autoMin, autoMax] = minY <= maxY ? uPlot.rangeNum(minY, maxY, 0.1, true) : [-1, 1];
  const yRange = manualY ?? { min: autoMin ?? -1, max: autoMax ?? 1 };
  const current = useRef({ timeline, first, end, xRange, yRange, cursor, data });
  current.current = { timeline, first, end, xRange, yRange, cursor, data };
  function reset() { setManualX(null); setManualY(null); setReadout(null); }

  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const css = getComputedStyle(el), color = (name:string) => css.getPropertyValue(name).trim();
    const instance = new uPlot({ width: el.clientWidth || 450, height: Math.max(90, el.clientHeight || 300),
      padding:[10,18,0,0], legend:{show:false}, cursor:{drag:{x:false,y:false,setScale:false}},
      scales:{x:{time:false,auto:false},y:{auto:false}},
      series:[{},...keys.map((key,i) => ({ label:demo ? demoNames[key] || key : key, stroke:color(`--channel-${i%8}`), width:1.7, spanGaps:false, points:{show:false} }))],
      axes:[{stroke:color('--muted'),grid:{stroke:color('--grid'),width:1},ticks:{show:false},font:'11px Consolas',size:27,values:(_u,values)=>{
        const range = current.current.xRange;
        const digits = Math.max(1, Math.min(5, Math.ceil(-Math.log10((range.max - range.min) / 6))));
        return values.map(n => `${n.toFixed(digits)}s`);
      }},
        {stroke:color('--muted'),grid:{stroke:color('--grid'),width:1},ticks:{show:false},font:'11px Consolas',size:45}],
      hooks:{setCursor:[u => {
        const view = current.current;
        const left = u.cursor.left ?? -1;
        if (!view.cursor || left < 0 || view.first >= view.end) { setReadout(null); return; }
        const x = u.posToVal(left, 'x');
        const index = Math.min(view.end, Math.max(view.first, plotIndex(view.timeline, x)));
        const before = view.timeline[Math.max(view.first, index - 1)];
        const after = view.timeline[Math.min(view.end - 1, index)];
        setReadout(Math.abs(before.x - x) <= Math.abs(after.x - x) ? before : after);
      }]},
    }, current.current.data, el);
    plot.current=instance;
    const overlay = instance.over;
    let pan: { pointer: number; left: number; top: number; x: PlotRange; y: PlotRange; movedX: boolean; movedY: boolean } | null = null;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const view = current.current;
      if (!view.timeline.length || !event.deltaY) return;
      const rect = overlay.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      if (event.ctrlKey) {
        const anchor = instance.posToVal(event.clientY - rect.top, 'y');
        const span = view.yRange.max - view.yRange.min;
        const minimum = Math.max(Number.EPSILON * Math.max(1, Math.abs(anchor)) * 64, 1e-12);
        setManualY(zoomRange(view.yRange, anchor, delta, minimum, Math.max(span, 1e12)));
      } else {
        const anchor = instance.posToVal(event.clientX - rect.left, 'x');
        const duration = view.timeline[view.timeline.length - 1].x - view.timeline[0].x;
        setManualX(keepInBuffer(zoomRange(view.xRange, anchor, delta, 0.001, Math.max(60, duration)), view.timeline));
      }
    }
    function startPan(event: PointerEvent) {
      if (event.button !== 1) return;
      event.preventDefault();
      const view = current.current;
      if (!view.timeline.length) return;
      pan = { pointer: event.pointerId, left: event.clientX, top: event.clientY, x: view.xRange, y: view.yRange, movedX: false, movedY: false };
      overlay.classList.add('is-panning');
    }
    function movePan(event: PointerEvent) {
      if (!pan || event.pointerId !== pan.pointer) return;
      const rect = overlay.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = (pan.left - event.clientX) * (pan.x.max - pan.x.min) / rect.width;
      const dy = (event.clientY - pan.top) * (pan.y.max - pan.y.min) / rect.height;
      pan.movedX ||= dx !== 0;
      pan.movedY ||= dy !== 0;
      if (pan.movedX) setManualX(keepInBuffer({ min: pan.x.min + dx, max: pan.x.max + dx }, current.current.timeline));
      if (pan.movedY) setManualY({ min: pan.y.min + dy, max: pan.y.max + dy });
    }
    function endPan(event?: PointerEvent) {
      if (event && event.pointerId !== pan?.pointer) return;
      pan = null;
      overlay.classList.remove('is-panning');
    }
    const cancelPan = () => endPan();
    const cancelMiddleClick = (event: MouseEvent) => { if (event.button === 1) event.preventDefault(); };
    overlay.addEventListener('wheel', wheel, { passive: false });
    overlay.addEventListener('pointerdown', startPan);
    overlay.addEventListener('auxclick', cancelMiddleClick);
    overlay.addEventListener('dblclick', reset);
    window.addEventListener('pointermove', movePan);
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
    window.addEventListener('blur', cancelPan);
    const resize = new ResizeObserver(() => {
      if (!el.clientWidth) return;
      setWidth(el.clientWidth);
      instance.setSize({ width: el.clientWidth, height: Math.max(90, el.clientHeight) });
    });
    resize.observe(el);
    return () => {
      resize.disconnect();
      window.removeEventListener('pointermove', movePan);
      window.removeEventListener('pointerup', endPan);
      window.removeEventListener('pointercancel', endPan);
      window.removeEventListener('blur', cancelPan);
      instance.destroy();
      plot.current = null;
    };
  }, [theme, signature, demo]);
  useLayoutEffect(() => {
    const instance = plot.current;
    if (!instance) return;
    instance.batch(() => {
      instance.setData(data, false);
      keys.forEach((key, i) => {
        const show = !hiddenChannels.includes(key);
        if (instance.series[i + 1].show !== show) instance.setSeries(i + 1, { show });
      });
      instance.setScale('x', { ...xRange });
      instance.setScale('y', { ...yRange });
    });
  }, [data, xRange.min, xRange.max, yRange.min, yRange.max, hiddenChannels, signature, theme, demo]);
  function toggle(key:string) {onHiddenChange(hiddenChannels.includes(key)?hiddenChannels.filter(k=>k!==key):[...hiddenChannels,key].slice(-32));}
  function all(show:boolean) {onHiddenChange(show ? hiddenChannels.filter(key=>!available.includes(key)) : [...new Set([...hiddenChannels,...available])].slice(-32));}
  const latest = timeline.at(-1);
  const gestures = '滚轮缩放时间 · Ctrl + 滚轮缩放幅度 · 中键平移 · 双击复位';
  const displayedRange = `波形图，时间 ${xRange.min.toFixed(6)} 至 ${xRange.max.toFixed(6)} 秒，幅值 ${yRange.min.toPrecision(6)} 至 ${yRange.max.toPrecision(6)}`;
  return <section className="panel waveform-panel glass" id="waveform-panel" aria-label="多通道波形">
    <header className="panel-header"><div className="panel-title"><Waves size={17}/><h2>实时波形</h2><span className="count">{available.length} 通道</span></div><IconButton label="收起波形面板" onClick={onCollapse}><PanelRightClose size={16}/></IconButton></header>
    <div className="scope-toolbar"><label className={`scope-unit ${groups.length>1?'has-groups':''}`}>{selectedGroup === '数值' ? '幅值' : selectedGroup || '幅值'}{groups.length>1&&<select aria-label="波形单位分组" value={selectedGroup} onChange={e=>{setGroup(e.target.value);setManualY(null);setReadout(null);}}>{groups.map(unit=><option key={unit}>{unit}</option>)}</select>}</label><div className="actions"><select aria-label="波形时间窗" value={span} onChange={e=>{setSpan(Number(e.target.value));reset();}}><option value={2}>最近 2 s</option><option value={5}>最近 5 s</option><option value={10}>最近 10 s</option><option value={60}>最近 60 s</option></select><IconButton label="十字游标" selected={cursor} onClick={()=>{setCursor(!cursor);setReadout(null);}}><Crosshair size={15}/></IconButton><IconButton label="恢复波形时间窗" onClick={reset}><Maximize2 size={15}/></IconButton></div></div>
    <div className={`scope-content ${cursor?'':'hide-cursor'}`} title={gestures}><div className="chart-host" role="img" aria-label={displayedRange} ref={host}/>{!frames.length&&<div className="chart-empty"><Waves size={28}/><strong>等待数值数据</strong><span>完整数值帧将在这里绘制</span></div>}{frames.length>0&&!visible.length&&<div className="chart-empty"><Waves size={26}/><strong>通道已全部隐藏</strong><button className="secondary" onClick={()=>all(true)}>显示全部通道</button></div>}</div>
    <div className="scope-caption"><span>{readout&&cursor?`游标 ${((readout.timestamp - (origin.current ?? 0)) / 1000).toFixed(3)} s`:gestures}</span><span>{manualX?'历史视图':demo?'本地演示':'接收时间轴'}</span></div>
    <section className="channel-section" aria-label="波形通道"><header><strong>通道</strong><span>{visible.length} / {keys.length} 可见</span><div className="channel-bulk"><button onClick={()=>all(true)}>全部显示</button><button onClick={()=>all(false)}>全部隐藏</button></div></header><div className="channel-columns"><span>名称</span><span>{readout&&cursor?'游标值':'当前值'}</span><span>最小值</span><span>最大值</span></div><div className="channel-list">{keys.map((key,i)=>{
      const value=readout&&cursor?readout.values[key]:latest?.values[key], shown=!hiddenChannels.includes(key);
      return <label className={`channel-row ${shown?'':'channel-hidden'}`} key={key}><span className={`channel-checkbox color-${i%8}`}><input type="checkbox" aria-label={`显示通道 ${key}`} checked={shown} onChange={()=>toggle(key)}/><Check size={11}/></span><span className={`channel-swatch color-${i%8}`}/><span className="channel-name" title={demo ? demoNames[key] || key : key}><strong>{key}</strong></span><span className="channel-value">{typeof value==='number'&&Number.isFinite(value)?value.toFixed(3):'—'}<small>{selectedGroup==='数值'?'':selectedGroup}</small></span><span className="channel-stat">{ranges[key]?.min.toFixed(3) ?? '—'}</span><span className="channel-stat">{ranges[key]?.max.toFixed(3) ?? '—'}</span></label>;
    })}</div></section>
    <footer className="waveform-footer"><span className="source-dot"/>{dropped?`缓存已淘汰 ${dropped.toLocaleString()} 帧`:`${frames.length.toLocaleString()} 帧已接收`}<span className="waveform-footer-end">{demo?'10 Hz':'原始数值'}</span></footer>
  </section>;
}

