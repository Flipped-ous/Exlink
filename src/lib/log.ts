export type Direction = 'RX' | 'TX' | 'SYS';
export type LogEntry = { id: number; timestamp: number; direction: Direction; bytes: number[]; source: 'demo' | 'file' };
export type LogFilter = { direction: 'ALL' | Direction; query: string; format: 'text' | 'hex' };
const encoder = new TextEncoder();
export const toBytes = (s: string): number[] => Array.from(encoder.encode(s));
export const toHex = (bytes: number[]): string => bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
export const toText = (bytes: number[]): string => new TextDecoder().decode(new Uint8Array(bytes));
export function parseHex(s: string): number[] {
  const hex = s.replace(/\s/g, '');
  if (!hex || hex.length % 2 || !/^[a-f\d]+$/i.test(hex)) throw new Error('HEX 需要完整的字节，例如 AA 55 01 0D 0A。');
  return hex.match(/../g)!.map(b => parseInt(b, 16));
}
export function matches(entry: LogEntry, filter: LogFilter): boolean {
  if (filter.direction !== 'ALL' && filter.direction !== entry.direction) return false;
  const content = filter.format === 'hex' ? toHex(entry.bytes) : toText(entry.bytes);
  return content.toLowerCase().includes(filter.query.trim().toLowerCase());
}
export function appendBounded(existing: LogEntry[], incoming: LogEntry[], limit: number) {
  const all = [...existing, ...incoming];
  const dropped = Math.max(0, all.length - limit);
  return { entries: all.slice(dropped), dropped };
}
export function serializeLogs(entries: LogEntry[]) { return entries.map(entry => JSON.stringify(entry)).join('\n'); }
export function deserializeLogs(text: string): LogEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length > 10000) throw new Error('一次最多导入 10,000 条记录。');
  return lines.map((line, index) => {
    let v: unknown; try { v = JSON.parse(line); } catch { throw new Error(`第 ${index + 1} 行不是有效 JSON。`); }
    if (!v || typeof v !== 'object') throw new Error(`第 ${index + 1} 行格式不正确。`);
    const o = v as Record<string, unknown>;
    if (!['RX', 'TX', 'SYS'].includes(String(o.direction)) || !Number.isFinite(o.timestamp) || !Array.isArray(o.bytes) || o.bytes.length > 65536 || !o.bytes.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) throw new Error(`第 ${index + 1} 行缺少有效的时间、方向或字节数据。`);
    return { id: index + 1, timestamp: o.timestamp as number, direction: o.direction as Direction, bytes: o.bytes as number[], source: 'file' };
  });
}
export function timestamp(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleTimeString('zh-CN', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}
