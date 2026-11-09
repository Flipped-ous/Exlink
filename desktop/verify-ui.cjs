const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..'), output = path.join(root,'artifacts','ui');
const dpi = process.argv.find(value=>value.startsWith('--dpi='))?.split('=')[1];
if(dpi)app.commandLine.appendSwitch('force-device-scale-factor',dpi);
app.setPath('userData',path.join(root,'.cache','ui-verification-profile'));
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.disableHardwareAcceleration();
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
let win, failures=[], checks=[];
async function run(fn,...args) { let timer; try{return await Promise.race([win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`,true),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Renderer evaluation timed out')),6000)})]);}finally{clearTimeout(timer);} }
async function ready() { for(let n=0;n<80;n++){if(await run(()=>!!document.querySelector('.serial-workspace'))) return; await wait(50);}throw Error('App did not render'); }
async function click(selector) {await run(s=>{const el=document.querySelector(s);if(!el)throw Error(`Missing ${s}`);el.click();},selector);await wait(80);}
async function button(text) {await run(t=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);if(!el)throw Error(`Missing button ${t}`);el.click();},text);await wait(80);}
async function value(selector,text) {await run((s,v)=>{const el=document.querySelector(s);if(!el)throw Error(`Missing ${s}`);const type=el.tagName==='TEXTAREA'?HTMLTextAreaElement:el.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(type.prototype,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));},selector,text);await wait(80);}
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
 const image=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offscreen frame timed out')),6000);win.webContents.once('paint',(_event,_dirty,image)=>{clearTimeout(timer);resolve(image);});win.webContents.invalidate();});assert.ok(!image.isEmpty(),'Blank capture');
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
 if(old.webContents.getURL())win=new BrowserWindow({width:1440,height:900,useContentSize:true,show:false,backgroundColor:'#101018',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});
 console.log('LOAD',win.id);
 let timer;try{await Promise.race([win.loadFile(path.join(root,'dist','index.html')),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Navigation timed out')),10000)})]);}finally{clearTimeout(timer);}
 if(old!==win)old.destroy();await ready();console.log('READY',win.id);
}
app.whenReady().then(async()=>{
 fs.mkdirSync(output,{recursive:true});
 win=new BrowserWindow({width:1440,height:900,useContentSize:true,show:false,backgroundColor:'#101018',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}});
 const watchdog=setTimeout(()=>{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,failures:[...failures,'QA watchdog timeout']},null,2));app.exit(1);},90000);
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('console-message',(_e,details)=>{if(details.level==='error'||details.level===3)failures.push(details.message);});
 win.webContents.on('render-process-gone',(_e,d)=>failures.push(`Renderer gone: ${d.reason}`));
 try {
  await load();
  await run(()=>{localStorage.clear();});await load();
  if(dpi){await capture(`serial-dark-dpi-${dpi}-1440`);await capture(`serial-dark-dpi-${dpi}-960`,960,640);await theme('light');await capture(`serial-light-dpi-${dpi}-1440`);await capture(`serial-light-dpi-${dpi}-960`,960,640);fs.writeFileSync(path.join(output,`dpi-${dpi}.json`),JSON.stringify({checks,failures},null,2));clearTimeout(watchdog);win.destroy();app.exit(0);return;}
  await check('approved navigation and four-channel demo',async()=>{
   const nav=await run(()=>[...document.querySelectorAll('.activity-bar button')].map(e=>e.textContent.trim()));
   assert.deepEqual(nav,['串口调试','逻辑分析','智能电源','工具箱','设置']);
   assert.equal(await run(()=>document.querySelectorAll('.channel-row input').length),4);
   assert.equal(await run(()=>document.querySelectorAll('.u-series').length),0);
   assert.equal(await run(()=>document.documentElement.dataset.theme),'dark');
   assert.ok((await geometry()).chart.height>180);
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
   await click('[aria-label="重新载入演示"]');
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
 }catch(error){failures.push(error.stack);}
 const report={generatedAt:new Date().toISOString(),checks,failures};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,errors:failures}));
 clearTimeout(watchdog);win.destroy();app.exit(failures.length?1:0);
}).catch(error=>{console.error(error);app.exit(1);});
