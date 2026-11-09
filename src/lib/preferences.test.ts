import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences } from './preferences';
test('legacy preferences preserve theme and module choices without reopening connection UI',()=>{
 const p=parsePreferences(null,JSON.stringify({theme:'light',wave:true,view:'log',commands:false,sidebar:true,glass:false}));
 assert.equal(p.theme,'light');assert.equal(p.waveCollapsed,true);assert.equal(p.commands,false);assert.equal(p.glass,false);assert.equal('sidebar' in p,false);
});
test('new waveform collapse, hidden channels and units survive serialization',()=>{
 const p=parsePreferences(JSON.stringify({theme:'dark',waveCollapsed:true,hiddenChannels:['CH2','CH4','CH2'],channelUnits:{CH1:'V',CH4:'A'}}));
 assert.equal(p.waveCollapsed,true);assert.deepEqual(p.hiddenChannels,['CH2','CH4']);assert.deepEqual(parsePreferences(JSON.stringify(p)),p);
});
test('invalid local preferences recover safely and cannot create unbounded channel lists',()=>{
 for(const raw of ['null','[]','{'])assert.equal(parsePreferences(raw).theme,'dark');
 const p=parsePreferences(JSON.stringify({hiddenChannels:Array.from({length:100},(_,i)=>`CH${i}`),channelUnits:{bad:'watts',okay:'A'}}));
 assert.equal(p.hiddenChannels.length,32);assert.deepEqual(p.channelUnits,{okay:'A'});
});
