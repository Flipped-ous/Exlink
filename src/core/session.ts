import type { LogEntry } from '../lib/log';

export type Protocol = 'key-value' | 'csv' | 'just-float';
export type SampleFrame = { timestamp: number; sequence: number; epoch: number; values: Record<string, number> };
type Decoded = { timestamp: number; values: Record<string, number> };
export type DecodeResult = { frames: Decoded[]; issues: string[] };
const MAX_PENDING = 64 * 1024;
const MAX_CHANNELS = 32;
const FLOAT_TAIL = [0, 0, 128, 127];

/** Incremental framing owned by one source/connection, independent of its views. */
export class StreamDecoder {
  private pending: number[] = [];
  private discardingLine = false;
  private discardingBinary = false;
  constructor(readonly protocol: Protocol = 'key-value') {}
  reset() { this.pending = []; this.discardingLine = false; this.discardingBinary = false; }
  feed(bytes: readonly number[], timestamp: number): DecodeResult {
    const result: DecodeResult = { frames: [], issues: [] };
    for (const byte of bytes) {
      if (this.protocol !== 'just-float' && this.discardingLine) {
        if (byte === 10) this.discardingLine = false;
        continue;
      }
      this.pending.push(byte);
      if (this.protocol === 'just-float') {
        const n = this.pending.length;
        if (n >= 4 && FLOAT_TAIL.every((b, i) => this.pending[n - 4 + i] === b)) {
          const payload = this.pending.slice(0, -4); this.pending = [];
          if (this.discardingBinary) { this.discardingBinary = false; continue; }
          if (!payload.length || payload.length % 4 || payload.length / 4 > MAX_CHANNELS) { result.issues.push('JustFloat 帧长度无效'); continue; }
          const view = new DataView(Uint8Array.from(payload).buffer);
          const fields = Array.from({ length: payload.length / 4 }, (_, i): [string, number] => [`CH${i + 1}`, view.getFloat32(i * 4, true)]);
          if (fields.some(([, value]) => !Number.isFinite(value))) { result.issues.push('JustFloat 帧含非有限数值'); continue; }
          result.frames.push({ timestamp, values: Object.fromEntries(fields) });
        }
      } else if (byte === 10) {
        const raw = Uint8Array.from(this.pending); this.pending = [];
        try {
          const line = new TextDecoder('utf-8', { fatal: true }).decode(raw).trim();
          if (!line || (this.protocol === 'key-value' && !/^[\p{L}_][\p{L}\p{N}_.-]{0,47}\s*:/u.test(line))) continue;
          const fields = line.split(',');
          if (fields.length > MAX_CHANNELS) throw new Error('通道数量超过 32');
          const names = new Set<string>();
          const values = fields.map((field, i): [string, number] => {
            const parts = this.protocol === 'csv' ? [`CH${i + 1}`, field] : field.split(':');
            const key = parts[0]?.trim();
            if (parts.length !== 2 || !key || !/^[\p{L}_][\p{L}\p{N}_.-]{0,47}$/u.test(key) || !parts[1].trim() || !Number.isFinite(Number(parts[1])) || names.has(key)) throw new Error(`第 ${i + 1} 个字段无效或重名，整帧未采纳`);
            names.add(key); return [key, Number(parts[1])];
          });
          result.frames.push({ timestamp, values: Object.fromEntries(values) });
        } catch (error) { result.issues.push((error as Error).message); }
      }
      if (this.pending.length > MAX_PENDING) {
        this.pending = this.protocol === 'just-float' ? this.pending.slice(-3) : [];
        this.discardingLine = this.protocol !== 'just-float'; this.discardingBinary = this.protocol === 'just-float';
        result.issues.push('未完成帧超过 64 KiB，已丢弃并重新同步');
      }
    }
    return result;
  }
}

/** Count and byte bounds are enforced independently; an oversized item is rejected. */
export class BoundedRing<T> {
  private slots: (T | undefined)[];
  private head = 0;
  private size = 0;
  private bytes = 0;
  constructor(private readonly capacity: number, private readonly maxBytes: number, private readonly weight: (item: T) => number) {
    if (!Number.isInteger(capacity) || capacity < 1 || maxBytes < 1) throw new Error('Invalid buffer limits');
    this.slots = Array(capacity);
  }
  push(item: T): { dropped: number; accepted: boolean } {
    const weight = this.weight(item);
    if (weight > this.maxBytes) return { dropped: 1, accepted: false };
    let dropped = 0;
    while (this.size >= this.capacity || this.bytes + weight > this.maxBytes) {
      const old = this.slots[this.head]!; this.bytes -= this.weight(old); this.slots[this.head] = undefined;
      this.head = (this.head + 1) % this.capacity; this.size--; dropped++;
    }
    this.slots[(this.head + this.size) % this.capacity] = item; this.size++; this.bytes += weight;
    return { dropped, accepted: true };
  }
  values(): T[] { return Array.from({ length: this.size }, (_, i) => this.slots[(this.head + i) % this.capacity]!); }
  clear() { this.slots = Array(this.capacity); this.head = 0; this.size = 0; this.bytes = 0; }
}

export type SessionSnapshot = {
  entries: LogEntry[]; samples: SampleFrame[]; dropped: number; sampleDropped: number;
  parseErrors: number; lastParseIssue: string; revision: number; epoch: number;
};
/** Raw records and decoded samples fan out from one source. UI pause does not stop ingest. */
export class SessionEngine {
  private raw = new BoundedRing<LogEntry>(5000, 8 * 1024 * 1024, row => row.bytes.length + 64);
  private numeric = new BoundedRing<SampleFrame>(20000, 8 * 1024 * 1024, row => 40 + Object.keys(row.values).reduce((n, key) => n + key.length * 2 + 8, 0));
  private decoder: StreamDecoder;
  private listeners = new Set<() => void>();
  private sequence = 0;
  private snapshot: SessionSnapshot = { entries: [], samples: [], dropped: 0, sampleDropped: 0, parseErrors: 0, lastParseIssue: '', revision: 0, epoch: 0 };
  constructor(entries: LogEntry[] = [], protocol: Protocol = 'key-value') { this.decoder = new StreamDecoder(protocol); this.replace(entries); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  append(entries: LogEntry[]) {
    let { dropped, sampleDropped, parseErrors, lastParseIssue } = this.snapshot;
    for (const entry of entries) {
      dropped += this.raw.push(entry).dropped;
      if (entry.direction !== 'RX') continue;
      const decoded = this.decoder.feed(entry.bytes, entry.timestamp);
      parseErrors += decoded.issues.length;
      if (decoded.issues.length) lastParseIssue = decoded.issues.at(-1)!;
      for (const frame of decoded.frames) sampleDropped += this.numeric.push({ ...frame, sequence: ++this.sequence, epoch: this.snapshot.epoch }).dropped;
    }
    this.snapshot = { ...this.snapshot, entries: this.raw.values(), samples: this.numeric.values(), dropped, sampleDropped, parseErrors, lastParseIssue, revision: this.snapshot.revision + 1 };
    this.listeners.forEach(listener => listener());
  }
  replace(entries: LogEntry[]) { this.rebuild(entries, this.decoder.protocol); }
  private rebuild(entries: LogEntry[], protocol: Protocol, dropped = 0) {
    this.decoder = new StreamDecoder(protocol);
    this.raw.clear(); this.numeric.clear(); this.decoder.reset(); this.sequence = 0;
    this.snapshot = { entries: [], samples: [], dropped, sampleDropped: 0, parseErrors: 0, lastParseIssue: '', revision: this.snapshot.revision, epoch: this.snapshot.epoch + 1 };
    this.append(entries);
  }
  setProtocol(protocol: Protocol) {
    if (this.decoder.protocol === protocol) return;
    this.rebuild(this.snapshot.entries, protocol, this.snapshot.dropped);
  }
  clearLogs() {
    this.raw.clear(); this.snapshot = { ...this.snapshot, entries: [], dropped: 0, revision: this.snapshot.revision + 1 };
    this.listeners.forEach(listener => listener());
  }
}

/** Preserve extrema from every selected channel on a shared time axis. Raw data is untouched. */
export function minMaxWindow(frames: SampleFrame[], keys: string[], budget: number): SampleFrame[] {
  if (frames.length <= Math.max(2, budget) || !keys.length) return frames;
  const buckets = Math.max(1, Math.floor((Math.max(budget, 2 + 2 * keys.length) - 2) / (2 * keys.length)));
  const indices = new Set([0, frames.length - 1]);
  // A missing-channel interval must remain a visible gap, even if that exceeds the soft pixel budget.
  for (let i = 1; i < frames.length; i++) for (const key of keys) {
    if (Number.isFinite(frames[i - 1].values[key]) !== Number.isFinite(frames[i].values[key])) { indices.add(i - 1); indices.add(i); }
  }
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = Math.floor(bucket * frames.length / buckets), end = Math.floor((bucket + 1) * frames.length / buckets);
    for (const key of keys) {
      let min = -1, max = -1;
      for (let i = start; i < end; i++) {
        const value = frames[i].values[key]; if (!Number.isFinite(value)) continue;
        if (min < 0 || value < frames[min].values[key]) min = i;
        if (max < 0 || value > frames[max].values[key]) max = i;
      }
      if (min >= 0) indices.add(min); if (max >= 0) indices.add(max);
    }
  }
  return [...indices].sort((a, b) => a - b).map(i => frames[i]);
}
