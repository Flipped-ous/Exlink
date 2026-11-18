const { app, BrowserWindow, ipcMain } = require('electron');
const { SerialPort, SerialPortMock } = require('serialport');
const { installSerialIpc } = require('./serial.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..'), output = path.join(root,'artifacts','ui');
const dpi = process.argv.find(value=>value.startsWith('--dpi='))?.split('=')[1];
const loopback = process.argv.includes('--loopback');
const webPreferences = { contextIsolation:true, nodeIntegration:false, sandbox:true, backgroundThrottling:false, offscreen:true,
  preload:path.join(__dirname,'preload.cjs') };
if(dpi)app.commandLine.appendSwitch('force-device-scale-factor',dpi);
const profile = loopback ? 'ui-loopback-profile' : dpi ? 'ui-dpi-profile' : 'ui-verification-profile';
app.setPath('userData',path.join(root,'.cache',profile));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.disableHardwareAcceleration();
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
let win, failures=[], checks=[];
let mockPort;
class TestPort extends SerialPortMock {
 constructor(options) {
  super(options);
  mockPort = this;
 }
}
SerialPortMock.binding.createPort('COM17', { record:true });
const serial = installSerialIpc(ipcMain, () => win?.isDestroyed() ? undefined : win?.webContents, loopback ? SerialPort : TestPort);
async function run(fn,...args) { let timer; try{return await Promise.race([win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`,true),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Renderer evaluation timed out')),6000)})]);}finally{clearTimeout(timer);} }
async function ready() { for(let n=0;n<80;n++){if(await run(()=>!!document.querySelector('.serial-workspace'))) return; await wait(50);}throw Error('App did not render'); }
async function click(selector) {await run(s=>{const el=document.querySelector(s);if(!el)throw Error(`Missing ${s}`);el.click();},selector);await wait(80);}
async function button(text) {await run(t=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);if(!el)throw Error(`Missing button ${t}`);el.click();},text);await wait(80);}
async function value(selector,text) {await run((s,v)=>{const el=document.querySelector(s);if(!el)throw Error(`Missing ${s}`);const type=el.tagName==='TEXTAREA'?HTMLTextAreaElement:el.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(type.prototype,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));},selector,text);await wait(80);}
async function until(condition, message) {
 for (let i = 0; i < 60; i++) {
  if (await condition()) return;
  await wait(50);
 }
 assert.fail(message);
}
function serialCall(call) { return new Promise((resolve, reject) => call(error => error ? reject(error) : resolve())); }
async function plotRange() {
 return run(() => {
  const label = document.querySelector('.chart-host').getAttribute('aria-label');
  return label.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
 });
}
async function signalPixels() {
 return run(() => {
  const canvas = document.querySelector('.chart-host canvas');
  const color = getComputedStyle(canvas).getPropertyValue('--channel-0').trim().slice(1);
  const channel = [0, 2, 4].map(i => parseInt(color.slice(i, i+2), 16));
  const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let i = 0; i < rgba.length; i+=4) {
   if (rgba[i+3]>150 && channel.every((value,j)=>Math.abs(value-rgba[i+j])<12)) count++;
  }
  return count;
 });
}
async function wheel(delta, ctrlKey = false) {
 await run((amount, control) => {
  const target = document.querySelector('.chart-host .u-over');
  const rect = target.getBoundingClientRect();
  const event = new WheelEvent('wheel', { bubbles:true, cancelable:true, deltaY:amount, ctrlKey:control,
   clientX:rect.left + rect.width / 2, clientY:rect.top + rect.height / 2 });
  target.dispatchEvent(event);
  if (!event.defaultPrevented) throw Error('Chart wheel must not zoom the application');
 }, delta, ctrlKey);
 await wait(80);
}
async function serialFlow(native) {
 const Port = native ? SerialPort : SerialPortMock;
 const path = native ? 'COM1' : 'COM17';
 if (native) {
  const ports = await Port.list();
  assert.ok(ports.some(port=>port.path===path && /COM1->COM2/.test(port.friendlyName)), 'COM1 must be the configured virtual peer of COM2');
  assert.ok(ports.some(port=>port.path==='COM2' && /COM2->COM1/.test(port.friendlyName)), 'COM2 must be the configured virtual peer of COM1');
 }
 const openOptions = { path, baudRate:115200, autoOpen:false, lock:true };
 const blocker = new Port(openOptions);
 const peer = native ? new Port({ ...openOptions, path:'COM2' }) : null;
 const peerReads = [];
 const status = () => run(() => document.querySelector('.serial-status').textContent.trim());
 const sendInbound = async bytes => {
  if (!peer) { mockPort.port.emitData(Buffer.from(bytes)); return; }
  await serialCall(done => peer.write(Buffer.from(bytes), done));
  await serialCall(done => peer.drain(done));
 };
 const hasLog = (direction, payload) => run((target, match) => [...document.querySelectorAll('.log-row')].some(row =>
  row.querySelector('.direction').textContent===target && row.querySelector('code').textContent.includes(match)), direction, payload);
 try {
  await until(() => run(port => [...document.querySelector('[aria-label="串口"]').options].some(entry => entry.value === port), path), 'COM port was not enumerated');
  await value('[aria-label="串口"]', path);
  await serialCall(done => blocker.open(done));
  await button('连接串口');
  await until(async () => (await status()) === '连接失败', 'An occupied port should report a connection failure');
  await serialCall(done => blocker.close(done));
  if (peer) {
   peer.on('data', bytes => peerReads.push(bytes));
   await serialCall(done => peer.open(done));
  }
  await button('连接串口');
  await until(async () => (await status()) === '已连接', 'The COM connection did not open');
  assert.equal(await run(() => document.querySelector('.terminal-panel .count').textContent), '0');
  assert.equal(await run(() => document.querySelector('[aria-label="导入日志"]').disabled), true);
  await value('[aria-label="发送内容"]', 'PING');
  await button('发送');
  await until(() => hasLog('TX', 'PING'), 'Successful text write missing from log');
  await button('HEX');
  await value('[aria-label="发送内容"]', 'AA 00 FF');
  await button('发送');
  await value('[aria-label="日志显示格式"]', 'hex');
  await until(() => hasLog('TX', 'AA 00 FF'), 'Successful HEX write missing from log');
  const expected = Buffer.from([80, 73, 78, 71, 13, 10, 170, 0, 255]);
  await until(async () => (peer ? Buffer.concat(peerReads) : mockPort.port.recording).equals(expected), 'Peer did not receive exact TX bytes');
  await sendInbound(Buffer.from('CH1:'));
  await wait(75);
  assert.ok(await run(() => document.querySelector('.chart-empty').textContent.includes('等待数值数据')));
  await sendInbound(Buffer.from('1\nCH1:99\nCH1:2\n'));
  await until(() => run(() => document.querySelector('.channel-row .channel-stat:last-child')?.textContent === '99.000'), 'The decoded spike should be visible');
  await until(() => hasLog('RX', '43 48 31'), 'Raw RX data should be visible');
  await until(async () => (await signalPixels()) > 5, 'Same-read frames should draw a visible line');
  await value('[aria-label="日志显示格式"]', 'text');
  await capture(native ? 'serial-loopback-1440' : 'serial-connected-1440');
  await capture(native ? 'serial-loopback-960' : 'serial-connected-960', 960, 640);
  win.setContentSize(1440, 900);
  if (!native) {
   mockPort.write = (_bytes, callback) => queueMicrotask(() => callback(new Error('设备已移除')));
   await value('[aria-label="发送内容"]', '11 22');
   await button('发送');
   await until(async () => (await status()) === '连接异常', 'A failed write should release the connection');
   assert.equal(await run(() => document.querySelector('[aria-label="发送内容"]').value), '11 22');
   assert.ok(await run(() => document.querySelector('.send-area [role="alert"]').textContent.includes('设备已移除')));
   assert.ok(await hasLog('TX', 'PING'));
  } else {
   await button('断开');
   await until(async () => (await status()) === '未连接', 'The COM connection did not close');
  }
  await button('连接串口');
  await until(async () => (await status()) === '已连接', 'Manual reconnection failed');
  assert.equal(await run(() => document.querySelector('.terminal-panel .count').textContent), '0');
  if (native) {
   await serial.disconnect();
   await serialCall(done => blocker.open(done));
   await serialCall(done => blocker.close(done));
  } else {
   await button('断开');
   await until(async () => (await status()) === '未连接', 'The test port did not close');
  }
 } finally {
  if (blocker.isOpen) await serialCall(done => blocker.close(done));
  if (peer?.isOpen) await serialCall(done => peer.close(done));
 }
}
async function check(name,fn) {try{console.log('CHECK',name);await fn();checks.push({name,pass:true});console.log('PASS',name);}catch(error){checks.push({name,pass:false,error:error.message});console.error('FAIL',name,error.stack);throw error;}}
async function geometry() {return run(()=>{
 const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
 const clipped=[...document.querySelectorAll('button,input,textarea,select')].filter(e=>{const s=getComputedStyle(e);const b=e.getBoundingClientRect();const scroller=e.closest('.log-scroll,.channel-list,.settings-content,.tool-page,.connection-popover,.history-popover');if(scroller){const r=scroller.getBoundingClientRect();if(b.bottom<=r.top||b.top>=r.bottom||b.right<=r.left||b.left>=r.right)return false;return false;}return b.width&&b.height&&s.visibility!=='hidden'&&s.display!=='none'&&(b.x < -1 || b.y < -1 || b.right>innerWidth+1 || b.bottom>innerHeight+1);}).map(e=>({name:e.getAttribute('aria-label')||e.textContent.trim(),rect:e.getBoundingClientRect().toJSON()}));
 return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},rootWidth:document.documentElement.scrollWidth,nav:r('.activity-bar'),log:r('.terminal-panel'),wave:r('.waveform-panel'),chart:r('.chart-host'),send:r('.send-form'),clipped};
});}
async function capture(name,width=1440,height=900,zoom=1) {
 win.webContents.setZoomFactor(zoom);win.setContentSize(width,height);await wait(180);
 await run(()=>{document.querySelector('.toast button')?.click();});await wait(90);
 const contrast=await run(()=>{
  function rgb(value){if(value.startsWith('#')){let h=value.slice(1);if(h.length===3)h=h.split('').map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}return value.match(/[\d.]+/g).slice(0,3).map(Number);}
  function luminance(c){return c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
  function ratio(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  const css=getComputedStyle(document.documentElement),fg=rgb(css.getPropertyValue('--primary-text').trim());
  const colors=['--primary','--primary-hover'].flatMap(key=>{const base=rgb(css.getPropertyValue(key).trim());return[base,base.map(v=>v*(1-38/255)+255*38/255)];});
  const placeholderElement=document.querySelector('[aria-label="筛选日志"],textarea,input[type=number]');const placeholderColor=placeholderElement ? getComputedStyle(placeholderElement,'::placeholder').color : null;
  return {placeholderContrast:placeholderColor?ratio(rgb(placeholderColor),rgb(css.getPropertyValue('--surface').trim())):null,minimumPrimary:Math.min(...colors.map(c=>ratio(c,fg))),placeholder:document.querySelector('[aria-label="筛选日志"],textarea,input[type=number]') ? getComputedStyle(document.querySelector('[aria-label="筛选日志"],textarea,input[type=number]'),'::placeholder').color : null};
 });assert.ok(contrast.minimumPrimary>=4.5,`Primary contrast ${contrast.minimumPrimary}`);if(contrast.placeholderContrast)assert.ok(contrast.placeholderContrast>=4.5,`Placeholder contrast ${contrast.placeholderContrast}`);
 const info=await geometry();assert.equal(info.clipped.length,0,`Controls outside viewport: ${JSON.stringify(info.clipped)}`);
 assert.ok(info.rootWidth<=info.viewport.width+1,'Document horizontal overflow');
 if(info.wave&&info.viewport.width>=1180)assert.ok(info.wave.x>info.log.x,'Desktop must use two columns');
 if(info.wave&&info.viewport.width<1180)assert.ok(info.wave.bottom<=info.log.y+2,'Narrow window must stack waveform above log');
 const paint=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offscreen frame timed out')),6000);win.webContents.once('paint',(_event,_dirty,image)=>{clearTimeout(timer);resolve(image);});win.webContents.invalidate();});
 await paint();
 const image=await paint();assert.ok(!image.isEmpty(),'Blank capture');
 fs.writeFileSync(path.join(output,`${name}.png`),image.toPNG());
 checks.push({name:`render ${name}`,pass:true,geometry:info,contrast,image:image.getSize()});console.log('CAPTURE',name,JSON.stringify(info.viewport));
}
async function navigateSerial(){await button('串口调试');}
async function theme(which){await button('设置');await button('外观');await run(t=>{const el=document.querySelector(`.${t}-preview`);el.click();},which);await navigateSerial();}
async function importRows(rows,name='test.jsonl') {
 await run((lines,filename)=>{const file=new File([lines.map(x=>JSON.stringify(x)).join('\n')],filename,{type:'application/x-ndjson'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},rows,name);await wait(180);
}

async function load() {
 const old=win;
 if(old.webContents.getURL())win=new BrowserWindow({width:1440,height:900,useContentSize:true,show:false,backgroundColor:'#101018',webPreferences});
 console.log('LOAD',win.id);
 let timer;try{await Promise.race([win.loadFile(path.join(root,'dist','index.html')),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Navigation timed out')),10000)})]);}finally{clearTimeout(timer);}
 if(old!==win)old.destroy();await ready();console.log('READY',win.id);
}
app.whenReady().then(async()=>{
 fs.mkdirSync(output,{recursive:true});
 win=new BrowserWindow({width:1440,height:900,useContentSize:true,show:false,backgroundColor:'#101018',webPreferences});
 const watchdog=setTimeout(()=>{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,failures:[...failures,'QA watchdog timeout']},null,2));app.exit(1);},90000);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('console-message',(_e,details)=>{if(details.level==='error'||details.level===3)failures.push(details.message);});
 win.webContents.on('render-process-gone',(_e,d)=>failures.push(`Renderer gone: ${d.reason}`));
 try {
  await load();
  await run(()=>{localStorage.clear();});await load();
  if(loopback) {
   await check('native Windows COM1↔COM2 serial round trip and port release', () => serialFlow(true));
   fs.writeFileSync(path.join(output,'serial-loopback.json'),JSON.stringify({checks,failures},null,2));
   await serial.dispose();clearTimeout(watchdog);win.destroy();app.exit(0);return;
  }
  if(dpi){await capture(`serial-dark-dpi-${dpi}-1440`);await capture(`serial-dark-dpi-${dpi}-960`,960,640);await theme('light');await capture(`serial-light-dpi-${dpi}-1440`);await capture(`serial-light-dpi-${dpi}-960`,960,640);fs.writeFileSync(path.join(output,`dpi-${dpi}.json`),JSON.stringify({checks,failures},null,2));clearTimeout(watchdog);win.destroy();app.exit(0);return;}
  await check('approved navigation and four-channel demo',async()=>{
   const nav=await run(()=>[...document.querySelectorAll('.activity-bar button')].map(e=>e.textContent.trim()));
   assert.deepEqual(nav,['串口调试','逻辑分析','智能电源','工具箱','设置']);
   assert.equal(await run(()=>document.querySelectorAll('.channel-row input').length),4);
   assert.equal(await run(()=>document.querySelectorAll('.u-series').length),0);
   assert.equal(await run(()=>document.documentElement.dataset.theme),'dark');
   assert.ok((await geometry()).chart.height>180);
   await until(async () => (await signalPixels()) > 100, 'Demo waveform did not draw onto the canvas');
  });
  await capture('serial-dark-1440');
  await check('collapse retains command, expands log, and continues ingest',async()=>{
   await value('[aria-label="发送内容"]','status');
   const beforeWidth=(await geometry()).log.width;
   await button('运行演示');await button('收起波形');
   assert.equal(await run(()=>!!document.querySelector('.waveform-panel')),false);
   assert.ok((await geometry()).log.width>beforeWidth*1.4);
   const count=await run(()=>Number(document.querySelector('.status-bar>span[title]').textContent.replace(/\D/g,'')));
   await wait(450);
   assert.ok(await run(n=>Number(document.querySelector('.status-bar>span[title]').textContent.replace(/\D/g,''))>n,count));
   assert.equal(await run(()=>document.querySelector('[aria-label="发送内容"]').value),'status');
   await button('停止演示');await capture('serial-collapsed-1440');await button('展开波形');
  });
  await check('independent visibility, all hide/show, persistence',async()=>{
   await click('[aria-label="显示通道 CH2"]');
   assert.equal(await run(()=>document.querySelector('[aria-label="显示通道 CH2"]').checked),false);
   await button('收起波形');await load();
   assert.equal(await run(()=>!!document.querySelector('.waveform-panel')),false);
   await button('展开波形');assert.equal(await run(()=>document.querySelector('[aria-label="显示通道 CH2"]').checked),false);
   await button('全部隐藏');assert.ok(await run(()=>document.querySelector('.chart-empty').textContent.includes('通道已全部隐藏')));
   await button('全部显示');assert.ok(await run(()=>[...document.querySelectorAll('.channel-row input')].every(e=>e.checked)));
  });
  await check('pause freezes both views while ingest continues',async()=>{
   await button('运行演示');await click('[aria-label="暂停数据显示"]');
   const count=await run(()=>document.querySelector('.terminal-panel .count').textContent);
   const values=await run(()=>document.querySelector('.channel-list').textContent);
   await wait(400);
   assert.equal(await run(()=>document.querySelector('.terminal-panel .count').textContent),count);
   assert.equal(await run(()=>document.querySelector('.channel-list').textContent),values);
   assert.ok(await run(()=>document.querySelector('.log-view-status').textContent.includes('新记录')));
   await click('[aria-label="恢复数据显示"]');await button('停止演示');
  });
  await check('HEX validation and simulated TX/RX, filtering, detail',async()=>{
   await button('HEX');await value('[aria-label="发送内容"]','GG');await button('模拟发送');
   assert.ok(await run(()=>!!document.querySelector('.error-text[role=alert]')));
   await value('[aria-label="发送内容"]','AA 55 01');await button('模拟发送');
   assert.equal(await run(()=>!!document.querySelector('.error-text[role=alert]')),false);
   await button('TX');assert.ok(await run(()=>document.querySelectorAll('.log-row').length>0));
   assert.ok(await run(()=>[...document.querySelectorAll('.log-row')].every(e=>e.textContent.includes('TX'))));
   await value('[aria-label="筛选日志"]','impossible-query');assert.ok(await run(()=>!!document.querySelector('.empty-log')));
   await value('[aria-label="筛选日志"]','');await click('.log-row');assert.ok(await run(()=>document.querySelector('.hex-detail').textContent.includes('AA 55 01')));
   await click('[aria-label="关闭记录详情"]');await button('全部');await button('文本');await value('[aria-label="发送内容"]','');
  });
  await check('connection overlay and Escape focus return',async()=>{
   await button('连接配置');assert.equal(await run(()=>document.querySelector('[role=dialog]').getAttribute('aria-label')),'连接与协议');
   await capture('connection-dark-1440');
   await run(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await wait(80);
   assert.equal(await run(()=>!!document.querySelector('[role=dialog]')),false);
   assert.ok(await run(()=>document.activeElement.textContent.includes('连接配置')));
  });
  await check('unit grouping is configurable and persists',async()=>{
   await button('设置');await button('数据与解析');await value('[aria-label="通道 CH4 单位"]','A');await navigateSerial();
   assert.ok(await run(()=>!!document.querySelector('[aria-label="波形单位分组"]')));
   await value('[aria-label="波形单位分组"]','A');assert.equal(await run(()=>document.querySelectorAll('.channel-row').length),1);
   assert.ok(await run(()=>document.querySelector('.channel-row').textContent.includes('CH4')));
   await value('[aria-label="波形单位分组"]','V');
   await button('设置');await button('数据与解析');await value('[aria-label="通道 CH4 单位"]','V');await navigateSerial();
  });
  await check('wheel, Ctrl-wheel, middle drag and double click keep acquisition running', async () => {
   await button('运行演示');
   const initial = await plotRange();
   await wheel(-300);
   const zoomed = await plotRange();
   assert.ok(zoomed[1] - zoomed[0] < initial[1] - initial[0]);
   await wheel(-300, true);
   const amplitude = await plotRange();
   assert.deepEqual(amplitude.slice(0, 2), zoomed.slice(0, 2));
   assert.ok(amplitude[3] - amplitude[2] < zoomed[3] - zoomed[2]);
   await run(() => {
    const target = document.querySelector('.chart-host .u-over');
    const { left, top, width, height } = target.getBoundingClientRect();
    const mouse = { bubbles:true, cancelable:true, pointerId:1, pointerType:'mouse', button:1 };
    const clientX = left + width / 2, clientY = top + height / 2;
    target.dispatchEvent(new PointerEvent('pointerdown',{...mouse,clientX,clientY,buttons:4}));
    target.dispatchEvent(new PointerEvent('pointermove',{...mouse,clientX:clientX+width/4,clientY,buttons:4}));
    target.dispatchEvent(new PointerEvent('pointerup',{...mouse,clientX:clientX+width/4,clientY,buttons:0}));
   });
   await wait(80);
   const panned = await plotRange();
   assert.ok(panned[0] < amplitude[0]);
   const count = await run(() => Number(document.querySelector('.terminal-panel .count').textContent));
   await wait(320);
   assert.ok(await run(before=>Number(document.querySelector('.terminal-panel .count').textContent)>before, count));
   assert.deepEqual(await plotRange(), panned);
   await run(() => document.querySelector('.chart-host .u-over').dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
   await wait(80);
   const reset = await plotRange();
   assert.ok(Math.abs(reset[1]-reset[0]-10)<0.001);
   await wait(220);
   assert.ok((await plotRange())[1]>reset[1]);
   await button('停止演示');
  });
  await check('keyboard search, keyboard send, time window and restore',async()=>{
   await run(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true})));
   assert.equal(await run(()=>document.activeElement.getAttribute('aria-label')),'筛选日志');
   await value('[aria-label="发送内容"]','status');
   const before=await run(()=>document.querySelector('.terminal-panel .count').textContent);
   await run(()=>document.querySelector('[aria-label="发送内容"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true})));await wait(80);
   assert.ok(Number(await run(()=>document.querySelector('.terminal-panel .count').textContent))>Number(before));
   const rangeRows=Array.from({length:101},(_,i)=>({timestamp:Date.now()-10000+i*100,direction:'RX',bytes:[...new TextEncoder().encode(`CH1:${i},CH2:${i+1},CH3:${i+2},CH4:${i+3}\n`)]}));
   await importRows(rangeRows,'window-fixture.jsonl');
   const range=await run(()=>document.querySelector('.channel-stat').textContent);
   await value('[aria-label="波形时间窗"]','2');
   assert.notEqual(await run(()=>document.querySelector('.channel-stat').textContent),range);
   await click('[aria-label="恢复波形时间窗"]');await value('[aria-label="波形时间窗"]','10');
   await click('[aria-label="载入演示"]');
   await value('[aria-label="发送内容"]','');
  });
  await check('filtered JSONL export preserves byte content',async()=>{
   const downloaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Download timeout')),6000);win.webContents.session.once('will-download',(_event,item)=>{item.setSavePath(path.join(output,'export-test.jsonl'));item.once('done',(_e,state)=>{clearTimeout(timer);state==='completed'?resolve(item.getSavePath()):reject(Error('Download failed: '+state));});});});
   await click('[aria-label="导出筛选后的日志"]');const saved=await downloaded;
   const records=fs.readFileSync(saved,'utf8').trim().split('\n').map(line=>JSON.parse(line));
   assert.ok(records.length>100);assert.ok(records.every(row=>Array.isArray(row.bytes)&&row.bytes.every(byte=>byte>=0&&byte<=255)));
  });
  await check('settings, glass switch, all tool pages',async()=>{
   await button('设置');await button('外观');await click('[aria-label="液态玻璃"]');
   assert.equal(await run(()=>document.documentElement.dataset.glass),'false');await click('[aria-label="液态玻璃"]');await capture('settings-dark-1440');
   await button('调试工作区');await click('[aria-label="显示快捷指令"]');await navigateSerial();assert.equal(await run(()=>!!document.querySelector('.quick-commands')),false);
   await button('设置');await button('调试工作区');await click('[aria-label="显示快捷指令"]');
   await button('逻辑分析');assert.equal(await run(()=>document.querySelectorAll('.logic-lane').length),8);await click('.logic-lane input');assert.equal(await run(()=>document.querySelector('.logic-lane input').checked),false);await capture('logic-dark-1440');
   await button('智能电源');await button('5 V');assert.equal(await run(()=>document.querySelector('input[type=number]').value),'5');assert.ok(await run(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开启输出')).disabled));await capture('power-dark-1440');
   await button('工具箱');await click('.toolbox-list>button');
  });
 }catch(error){failures.push(error.stack);}
 // Complete the viewport matrix even if an interaction assertion fails.
 try{
  await navigateSerial();await button('重新载入演示').catch(()=>click('[aria-label="重新载入演示"]'));
  for(const t of ['dark','light']){await theme(t);for(const [w,h]of[[1440,900],[1280,800],[960,640]])await capture(`serial-${t}-${w}`,w,h);}
  await theme('dark');for(const z of[1.25,1.5])await capture(`serial-dark-zoom-${z}`,1440,900,z);
  win.webContents.setZoomFactor(1);win.setContentSize(1440,900);
  const many=Array.from({length:80},(_,i)=>({timestamp:Date.now()-8000+i*100,direction:'RX',bytes:[...new TextEncoder().encode(Array.from({length:32},(_,n)=>`channel_${n+1}:${(Math.sin(i/8+n)*2).toFixed(3)}`).join(',')+'\n')]}));
  await importRows(many,'32-channels.jsonl');assert.equal(await run(()=>document.querySelectorAll('.channel-row input').length),32);await capture('serial-32-channels');
  const offlineDisabled=await run(()=>document.querySelector('[aria-label="发送内容"]').disabled);assert.ok(offlineDisabled);checks.push({name:'32-channel import and offline send disabled',pass:true});
  await importRows([{timestamp:Date.now(),direction:'RX',bytes:[...new TextEncoder().encode('constructor:1,toString:2,__proto__:3\n')]}],'field-names.jsonl');
  assert.equal(await run(()=>document.querySelectorAll('.channel-row input').length),3);checks.push({name:'prototype-named numeric channels render safely',pass:true});
  await click('[aria-label="清空日志"]');assert.ok(await run(()=>!!document.querySelector('.empty-log')));assert.equal(await run(()=>document.querySelectorAll('.channel-row').length),3);
  await importRows([{timestamp:Date.now(),direction:'RX',bytes:[...new TextEncoder().encode('plain text without numeric data\n')]}],'text-only.jsonl');assert.ok(await run(()=>document.querySelector('.chart-empty').textContent.includes('等待数值数据')));await capture('serial-empty-wave');
  await importRows([{timestamp:1,direction:'RX',bytes:[999]}],'invalid.jsonl');assert.ok(await run(()=>document.querySelector('[role=status]').textContent.includes('有效')));
  await check('serial bridge connects, preserves bytes, reports errors and reconnects', async () => {
   await click('[aria-label="载入演示"]');
   await serialFlow(false);
  });
 }catch(error){failures.push(error.stack);}
 await serial.dispose();
 const report={generatedAt:new Date().toISOString(),checks,failures};fs.writeFileSync(path.join(output,loopback?'serial-loopback.json':'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,errors:failures}));
 clearTimeout(watchdog);win.destroy();app.exit(failures.length?1:0);
}).catch(error=>{console.error(error);app.exit(1);});
