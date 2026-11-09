import { toBytes, type Direction, type LogEntry } from './log';
let sequence = 0;
export const makeEntry = (message: string, direction: Direction = 'RX'): LogEntry => ({ id: ++sequence, timestamp: Date.now(), direction, bytes: toBytes(message), source: 'demo' });
export function demoRows() {
  const start = Date.now() - 10000;
  const rows = [{ ...makeEntry('四通道本地演示已就绪。硬件未连接。', 'SYS'), timestamp: start - 100 }];
  for (let i = 0; i <= 100; i++) rows.push({ ...sampleEntry(i / 10), timestamp: start + i * 100 });
  return rows;
}
export function sampleEntry(t: number): LogEntry {
  const a = 2.4 + .9 * Math.sin(t * 1.65), b = 2.3 + .65 * Math.sin(t * 1.65 + .9);
  const c = 1.65 + .32 * Math.sin(t * 3.3) + .12 * Math.sin(t * 8.2);
  const d = 2.0 + .45 * Math.cos(t * 1.1 + 2) + .10 * Math.sin(t * 5.8);
  return makeEntry(`CH1:${a.toFixed(3)},CH2:${b.toFixed(3)},CH3:${c.toFixed(3)},CH4:${d.toFixed(3)}\r\n`);
}
