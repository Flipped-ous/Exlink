import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { Check, Crosshair, Maximize2, PanelRightClose, Waves } from 'lucide-react';
import { minMaxWindow, type SampleFrame } from '../core/session';
import { IconButton } from './UI';

type Props = { frames: SampleFrame[]; theme: string; demo: boolean; hiddenChannels: string[]; channelUnits: Record<string,string>; onHiddenChange: (keys: string[]) => void; onCollapse: () => void; dropped: number };
const demoNames: Record<string,string> = { CH1: '主信号', CH2: '相移信号', CH3: '复合信号', CH4: '调制信号', target:'目标转速',speed:'实际转速',current:'电流',voltage:'电压' };
function unitFor(key:string,demo:boolean) { if (!demo) return '数值'; return /^CH[1-4]$/.test(key) || key==='voltage' ? 'V' : key==='current' ? 'A' : key==='target'||key==='speed' ? 'RPM' : '数值'; }
export default function Waveform({ frames, theme, demo, hiddenChannels, channelUnits, onHiddenChange, onCollapse, dropped }: Props) {
  const host = useRef<HTMLDivElement>(null), plot = useRef<uPlot | null>(null);
  const [cursor, setCursor] = useState(true), [span, setSpan] = useState(10), [width, setWidth] = useState(500), [group, setGroup] = useState('V');
  const [readout, setReadout] = useState<{ time:number; values:(number|null|undefined)[] } | null>(null);
  const available = useMemo(() => [...new Set(frames.flatMap(f => Object.keys(f.values)))].slice(0,32), [frames]);
  const groups: string[] = [...new Set(available.map(key => (Object.hasOwn(channelUnits,key) ? channelUnits[key] : unitFor(key,demo))))];
  const selectedGroup = groups.includes(group) ? group : groups[0];
  const keys = available.filter(key => (Object.hasOwn(channelUnits,key) ? channelUnits[key] : unitFor(key,demo)) === selectedGroup), signature = keys.join('|');
  const visible = keys.filter(key => !hiddenChannels.includes(key)), visibleSignature = visible.join('|');
  const data = useMemo<uPlot.AlignedData>(() => {
    const ordered = [...frames].sort((a,b) => a.timestamp-b.timestamp || a.sequence-b.sequence);
    const last = ordered.at(-1)?.timestamp ?? 0, first = ordered[0]?.timestamp ?? 0;
    const unique = new Map<number,SampleFrame>();
    ordered.filter(f => f.timestamp >= last - span*1000).forEach(f => unique.set(f.timestamp,f));
    const view = minMaxWindow([...unique.values()], visible, Math.max(64,Math.floor(width)));
    return [view.map(f => (f.timestamp-first)/1000), ...keys.map(key => view.map(f => Number.isFinite(f.values[key]) ? f.values[key] : null))];
  }, [frames,span,width,signature,visibleSignature]);
  const ranges = useMemo(() => {
    const latest = Math.max(0, ...frames.map(frame => frame.timestamp));
    const window = frames.filter(frame => frame.timestamp >= latest - span * 1000);
    return Object.fromEntries(keys.map(key => {
      const values = window.map(frame => frame.values[key]).filter(Number.isFinite);
      return [key, values.length ? {min:Math.min(...values),max:Math.max(...values)} : null];
    }));
  }, [frames, span, signature]);
  const current = useRef(data); current.current = data;
  const cursorEnabled = useRef(cursor); cursorEnabled.current = cursor;
  useEffect(() => {
    const el = host.current; if (!el) return;
    const css = getComputedStyle(el), color = (name:string) => css.getPropertyValue(name).trim();
    const instance = new uPlot({ width: el.clientWidth || 450, height: Math.max(100,el.clientHeight || 300),
      padding:[18,18,0,0], legend:{show:false}, cursor:{drag:{x:true,y:false,setScale:true}},
      scales:{x:{time:false},y:{auto:true}},
      series:[{},...keys.map((key,i) => ({ label:demo ? demoNames[key] || key : key, stroke:color(`--channel-${i%8}`), width:1.7, spanGaps:false, points:{show:false} }))],
      axes:[{stroke:color('--muted'),grid:{stroke:color('--grid'),width:1},ticks:{show:false},font:'11px Consolas',size:32,values:(_u,values)=>values.map(n=>`${n.toFixed(1)}s`)},
        {stroke:color('--muted'),grid:{stroke:color('--grid'),width:1},ticks:{show:false},font:'11px Consolas',size:45}],
      hooks:{setCursor:[u=>{
        if(!cursorEnabled.current || u.cursor.idx == null || u.cursor.left == null || u.cursor.left<0) {setReadout(null);return;}
        const i=u.cursor.idx;setReadout({time:u.data[0][i],values:u.data.slice(1).map(series=>series[i])});
      }]},
    },current.current,el);
    plot.current=instance;
    const resize=new ResizeObserver(()=>{if(el.clientWidth){setWidth(el.clientWidth);instance.setSize({width:el.clientWidth,height:Math.max(100,el.clientHeight)});}});
    resize.observe(el);return()=>{resize.disconnect();instance.destroy();plot.current=null;};
  },[theme,signature]);
  useEffect(()=>{plot.current?.setData(data);keys.forEach((key,i)=>plot.current?.setSeries(i+1,{show:!hiddenChannels.includes(key)}));},[data,hiddenChannels,signature,theme]);
  function toggle(key:string) {onHiddenChange(hiddenChannels.includes(key)?hiddenChannels.filter(k=>k!==key):[...hiddenChannels,key].slice(-32));}
  function all(show:boolean) {onHiddenChange(show ? hiddenChannels.filter(key=>!available.includes(key)) : [...new Set([...hiddenChannels,...available])].slice(-32));}
  const latest=frames.at(-1);
  return <section className="panel waveform-panel glass" id="waveform-panel" aria-label="多通道波形">
    <header className="panel-header"><div className="panel-title"><Waves size={17}/><h2>实时波形</h2><span className="count">{available.length} 通道</span></div><IconButton label="收起波形面板" onClick={onCollapse}><PanelRightClose size={16}/></IconButton></header>
    <div className="scope-toolbar"><label className={`scope-unit ${groups.length>1?'has-groups':''}`}>{selectedGroup === '数值' ? '幅值' : selectedGroup || '幅值'}{groups.length>1&&<select aria-label="波形单位分组" value={selectedGroup} onChange={e=>setGroup(e.target.value)}>{groups.map(unit=><option key={unit}>{unit}</option>)}</select>}</label><div className="actions"><select aria-label="波形时间窗" value={span} onChange={e=>setSpan(Number(e.target.value))}><option value={2}>最近 2 s</option><option value={5}>最近 5 s</option><option value={10}>最近 10 s</option><option value={60}>最近 60 s</option></select><IconButton label="十字游标" selected={cursor} onClick={()=>{setCursor(!cursor);setReadout(null);}}><Crosshair size={15}/></IconButton><IconButton label="恢复波形时间窗" onClick={()=>plot.current?.setData(current.current)}><Maximize2 size={15}/></IconButton></div></div>
    <div className={`scope-content ${cursor?'':'hide-cursor'}`}><div className="chart-host" ref={host}/>{!frames.length&&<div className="chart-empty"><Waves size={28}/><strong>等待数值数据</strong><span>完整数值帧将在这里绘制</span></div>}{frames.length>0&&!visible.length&&<div className="chart-empty"><Waves size={26}/><strong>通道已全部隐藏</strong><button className="secondary" onClick={()=>all(true)}>显示全部通道</button></div>}</div>
    <div className="scope-caption"><span>{readout&&cursor?`游标 ${readout.time.toFixed(3)} s`:'拖动框选缩放，双击恢复'}</span><span>{demo?'本地演示':'接收时间轴'}</span></div>
    <section className="channel-section" aria-label="波形通道"><header><strong>通道</strong><span>{visible.length} / {keys.length} 可见</span><div className="channel-bulk"><button onClick={()=>all(true)}>全部显示</button><button onClick={()=>all(false)}>全部隐藏</button></div></header><div className="channel-columns"><span>名称</span><span>{readout&&cursor?'游标值':'当前值'}</span><span>最小值</span><span>最大值</span></div><div className="channel-list">{keys.map((key,i)=>{
      const value=readout&&cursor?readout.values[i]:latest?.values[key], shown=!hiddenChannels.includes(key);
      return <label className={`channel-row ${shown?'':'channel-hidden'}`} key={key}><span className={`channel-checkbox color-${i%8}`}><input type="checkbox" aria-label={`显示通道 ${key}`} checked={shown} onChange={()=>toggle(key)}/><Check size={11}/></span><span className={`channel-swatch color-${i%8}`}/><span className="channel-name" title={demo ? demoNames[key] || key : key}><strong>{key}</strong></span><span className="channel-value">{typeof value==='number'&&Number.isFinite(value)?value.toFixed(3):'—'}<small>{selectedGroup==='数值'?'':selectedGroup}</small></span><span className="channel-stat">{ranges[key]?.min.toFixed(3) ?? '—'}</span><span className="channel-stat">{ranges[key]?.max.toFixed(3) ?? '—'}</span></label>;
    })}</div></section>
    <footer className="waveform-footer"><span className="source-dot"/>{dropped?`缓存已淘汰 ${dropped.toLocaleString()} 帧`:`${frames.length.toLocaleString()} 帧已接收`}<span className="waveform-footer-end">{demo?'10 Hz':'原始数值'}</span></footer>
  </section>;
}

