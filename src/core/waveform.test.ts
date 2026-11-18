import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deserializeLogs, serializeLogs, toBytes, type LogEntry } from '../lib/log';
import { minMaxWindow, SessionEngine } from './session';
import { buildTimeline, followLatest, keepInBuffer, plotIndex, zoomRange } from './waveform';

test('a serial read with multiple frames retains its same-timestamp spike and original bytes', () => {
  const timestamp = 1700000000000;
  const rows: LogEntry[] = [
    { id: 1, timestamp: timestamp - 1, direction: 'RX', bytes: toBytes('CH1:'), source: 'serial' },
    { id: 2, timestamp, direction: 'RX', bytes: toBytes('1\nCH1:99\nCH1:2\n'), source: 'serial' },
    { id: 3, timestamp, direction: 'TX', bytes: [0, 255, 13, 10], source: 'serial' },
    { id: 4, timestamp: timestamp + 1, direction: 'RX', bytes: toBytes('CH1:3\n'), source: 'serial' },
  ];
  const session = new SessionEngine(rows);
  const timeline = buildTimeline(session.getSnapshot().samples, timestamp);
  assert.deepEqual(timeline.map(frame => frame.values.CH1), [1, 99, 2, 3]);
  assert.ok(timeline.every((frame, i) => i === 0 || frame.x > timeline[i - 1].x));
  assert.deepEqual(timeline.map(frame => frame.timestamp), [timestamp, timestamp, timestamp, timestamp + 1]);
  assert.ok(minMaxWindow(timeline, ['CH1'], 2).some(frame => frame.values.CH1 === 99));
  assert.deepEqual(deserializeLogs(serializeLogs(session.getSnapshot().entries)).map(row => row.bytes), rows.map(row => row.bytes));
});

test('manual range stays on a retained interval as live frames arrive', () => {
  const frames = [0, 5, 10, 15, 20].map((seconds, i) => ({
    timestamp: seconds * 1000, sequence: i + 1, epoch: 1, values: { CH1: seconds },
  }));
  const timeline = buildTimeline(frames.slice(0, 4), 0);
  const latest = followLatest(timeline, 10);
  const zoomed = zoomRange(latest, 10, -250, 0.001, 60);
  assert.equal((zoomed.min + zoomed.max) / 2, 10);
  assert.ok(zoomed.max - zoomed.min < 10);
  const longer = buildTimeline(frames, 0);
  assert.deepEqual(keepInBuffer(zoomed, longer), zoomed);
  assert.equal(followLatest(longer, 10).max, 20);
  assert.equal(plotIndex(longer, 10), 2);
  assert.equal(plotIndex(longer, 10, true), 3);
});
