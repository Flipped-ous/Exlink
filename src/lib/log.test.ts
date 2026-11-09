import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHex, toHex, toBytes, toText, matches, appendBounded, serializeLogs, deserializeLogs, type LogEntry } from './log';
test('HEX bytes are exact and invalid input is rejected', () => {
  assert.deepEqual(parseHex('aA 55\n00 0d'), [170,85,0,13]);
  for (const bad of ['', 'A', 'GG', 'AA-55', '0xAA']) assert.throws(() => parseHex(bad));
  assert.equal(toHex([0,10,255]), '00 0A FF');
});
test('UTF-8 log round trip and direction/format filtering', () => {
  const entry: LogEntry = {id:1,timestamp:100,direction:'RX',bytes:toBytes('温度:25'),source:'demo'};
  assert.equal(toText(entry.bytes), '温度:25');
  assert.equal(matches(entry,{direction:'TX',query:'',format:'text'}),false);
  assert.equal(matches(entry,{direction:'RX',query:'温度',format:'text'}),true);
  assert.equal(matches(entry,{direction:'ALL',query:'e6 b8 a9',format:'hex'}),true);
  assert.deepEqual(deserializeLogs(serializeLogs([entry]))[0].bytes, entry.bytes);
});
test('bounded retention reports the exact number of discarded records', () => {
  const rows=Array.from({length:5},(_,id):LogEntry=>({id,timestamp:id,direction:'RX',bytes:[id],source:'demo'}));
  const out=appendBounded(rows.slice(0,3),rows.slice(3),3);
  assert.equal(out.dropped,2); assert.deepEqual(out.entries.map(r=>r.id),[2,3,4]);
});
test('malformed import cannot become a valid log record', () => {
  for(const v of ['no json','null','{"direction":"RX","timestamp":1,"bytes":[256]}','{"direction":"CTRL","timestamp":1,"bytes":[]}']) assert.throws(()=>deserializeLogs(v));
});
