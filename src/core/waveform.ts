import type { SampleFrame } from './session';

export type PlotFrame = SampleFrame & { x: number };
export type PlotRange = { min: number; max: number };

export function buildTimeline(frames: SampleFrame[], origin: number): PlotFrame[] {
  const ordered = [...frames].sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence);
  const timeline: PlotFrame[] = [];
  for (let start = 0; start < ordered.length;) {
    const timestamp = ordered[start].timestamp;
    let end = start + 1;
    while (ordered[end]?.timestamp === timestamp) end++;
    // Same-read frames have no measured time between them. Give them distinct
    // plot coordinates inside a fraction of the next interval, leaving RX time intact.
    const interval = end < ordered.length ? ordered[end].timestamp - timestamp : 1;
    const step = Math.min(0.5, interval / 2) / (end - start);
    for (let i = start; i < end; i++) {
      timeline.push({ ...ordered[i], x: (timestamp - origin + step * (i - start)) / 1000 });
    }
    start = end;
  }
  return timeline;
}

export function plotIndex(timeline: PlotFrame[], x: number, afterEqual = false) {
  let left = 0;
  let right = timeline.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const time = timeline[mid].x;
    if (time < x || (afterEqual && time === x)) left = mid + 1;
    else right = mid;
  }
  return left;
}

export function followLatest(timeline: PlotFrame[], span: number): PlotRange {
  const end = timeline.at(-1)?.x ?? span;
  return { min: end - span, max: end };
}

export function keepInBuffer(range: PlotRange, timeline: PlotFrame[]): PlotRange {
  if (!timeline.length) return range;
  const first = timeline[0].x;
  const last = timeline[timeline.length - 1].x;
  const span = range.max - range.min;
  const earliest = Math.min(first, last - span);
  const latest = Math.max(first, last - span);
  const min = Math.min(latest, Math.max(earliest, range.min));
  return min === range.min ? range : { min, max: min + span };
}

export function zoomRange(range: PlotRange, anchor: number, delta: number, minSpan: number, maxSpan: number): PlotRange {
  const span = range.max - range.min;
  const factor = Math.exp(Math.max(-500, Math.min(500, delta)) * 0.0015);
  const scale = Math.min(maxSpan, Math.max(minSpan, span * factor)) / span;
  return {
    min: anchor + (range.min - anchor) * scale,
    max: anchor + (range.max - anchor) * scale,
  };
}
