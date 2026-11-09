import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreamDecoder, BoundedRing, SessionEngine, minMaxWindow, type SampleFrame } from './session';
import { toBytes, type LogEntry } from '../lib/log';
test('incremental UTF-8 and partial/multiple frames preserve channel identity', () => {
  const d = new StreamDecoder(), bytes = toBytes('转速:1500,current:0.42\n转速:1501,current:0.43\n');
  assert.equal(d.feed(bytes.slice(0, 2), 100).frames.length, 0);
  const result = d.feed(bytes.slice(2), 110);
  assert.equal(result.frames.length, 2); assert.equal(result.frames[0].values['转速'], 1500);
  assert.equal(result.frames[1].values.current, .43); assert.deepEqual(result.issues, []);
});
test('bad fields reject the whole frame without shifting later channels', () => {
  const d = new StreamDecoder('csv');
  const r = d.feed(toBytes('1,bad,3\n4,5,6\n'), 100);
  assert.equal(r.issues.length, 1); assert.equal(r.frames.length, 1);
  assert.deepEqual(r.frames[0].values, { CH1: 4, CH2: 5, CH3: 6 });
});
test('JustFloat tail can span chunks; reset discards an earlier connection fragment', () => {
  const d = new StreamDecoder('just-float'), data = new Uint8Array(12), view = new DataView(data.buffer);
  view.setFloat32(0, 1.25, true); view.setFloat32(4, -3.5, true); data.set([0,0,128,127],8);
  assert.equal(d.feed([...data.slice(0,10)],1).frames.length,0);
  assert.deepEqual(d.feed([...data.slice(10)],2).frames[0].values,{CH1:1.25,CH2:-3.5});
  const text = new StreamDecoder(); text.feed(toBytes('speed:15'),1); text.reset();
  assert.equal(text.feed(toBytes('00\n'),2).frames.length,0);
});
test('oversized text frames are discarded until a real newline boundary', () => {
  const d = new StreamDecoder(); const bad = toBytes('speed:'+ '1'.repeat(66000));
  assert.ok(d.feed(bad,0).issues.length); assert.equal(d.feed(toBytes('23\nspeed:7\n'),1).frames[0].values.speed,7);
});
test('count and byte budgets both evict explicitly', () => {
  const r = new BoundedRing<string>(3, 5, v => v.length);
  r.push('aa'); r.push('bb'); assert.deepEqual(r.push('cc'),{dropped:1,accepted:true}); assert.deepEqual(r.values(),['bb','cc']);
  assert.deepEqual(r.push('123456'),{dropped:1,accepted:false}); assert.deepEqual(r.values(),['bb','cc']);
});
test('one session feeds raw and numeric views; clear log preserves samples, replacement resets epoch', () => {
  const row=(id:number,text:string):LogEntry=>({id,timestamp:id,direction:'RX',bytes:toBytes(text),source:'demo'});
  const engine=new SessionEngine([row(1,'speed:1500\n')]); let updates=0; const off=engine.subscribe(()=>updates++);
  const frozen=engine.getSnapshot(); engine.append([row(2,'speed:1499\n')]);
  assert.equal(frozen.samples.length,1); assert.equal(engine.getSnapshot().samples[1].values.speed,1499); assert.equal(updates,1);
  engine.clearLogs(); assert.equal(engine.getSnapshot().entries.length,0); assert.equal(engine.getSnapshot().samples.length,2);
  engine.replace([row(3,'speed:1400\n')]); assert.equal(engine.getSnapshot().samples.length,1); assert.ok(engine.getSnapshot().epoch>frozen.epoch); off();
});
test('pixel budget retains narrow spikes from different channels without modifying raw frames', () => {
  const frames:SampleFrame[]=Array.from({length:1000},(_,i)=>({timestamp:i,sequence:i,epoch:1,values:{a:i===423?99:0,b:i===750?-88:0}}));
  const small=minMaxWindow(frames,['a','b'],30);
  assert.ok(small.some(f=>f.values.a===99)); assert.ok(small.some(f=>f.values.b===-88));
  assert.equal(frames.length,1000); assert.ok(small.length<=30); assert.ok(small.every((f,i)=>!i||f.timestamp>small[i-1].timestamp));
});

test('downsampling preserves missing-channel boundaries instead of joining a false line', () => {
  const frames:SampleFrame[]=Array.from({length:100},(_,i)=>({timestamp:i,sequence:i,epoch:1,values:(i>=42&&i<45?{}:{a:i}) as Record<string,number>}));
  const small=minMaxWindow(frames,['a'],8);
  assert.ok(small.some(f=>f.timestamp===41)); assert.ok(small.some(f=>f.timestamp===42));
  assert.ok(small.some(f=>f.timestamp===44)); assert.ok(small.some(f=>f.timestamp===45));
});
test('changing protocol reparses raw bytes and retains earlier overflow reporting', () => {
  const rows:LogEntry[]=Array.from({length:5001},(_,i)=>({id:i,timestamp:i,direction:'RX',bytes:toBytes('1,2\n'),source:'demo'}));
  const engine=new SessionEngine(rows); const before=engine.getSnapshot();
  assert.equal(before.dropped,1); assert.equal(before.samples.length,0);
  engine.setProtocol('csv'); const after=engine.getSnapshot();
  assert.equal(after.dropped,1); assert.equal(after.entries.length,5000); assert.equal(after.samples.length,5000);
  assert.deepEqual(after.samples[0].values,{CH1:1,CH2:2}); assert.ok(after.epoch>before.epoch);
});
test('JustFloat overflow waits for the next delimiter before accepting another frame', () => {
  const d=new StreamDecoder('just-float'); d.feed(Array(65540).fill(1),0);
  assert.equal(d.feed([0,0,128,127],1).frames.length,0);
  const bytes=new Uint8Array(8);new DataView(bytes.buffer).setFloat32(0,3.5,true);bytes.set([0,0,128,127],4);
  assert.equal(d.feed([...bytes],2).frames[0].values.CH1,3.5);
});
