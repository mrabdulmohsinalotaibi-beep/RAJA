const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),path=require('node:path');
let wavNonce=0;
function wav(seconds){const b=Buffer.alloc(44+8000*seconds*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);b.writeInt16LE(++wavNonce,44);return b}
(async()=>{
 const server=spawn('python3',['-m','http.server','8772','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,600));browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:false,user:null}}));
  await page.goto('http://127.0.0.1:8772');await page.locator('#recorderMenu').click();
  for(const name of ['قائمة الفقه','قائمة التفسير']){await page.locator('#lessonNewList').click();await page.locator('#lessonName').fill(name);await page.locator('#lessonMinutes').fill('1');await page.locator('#lessonPartMinutes').fill('0');await page.locator('#lessonCreate button').click()}
  await page.waitForFunction(()=>window.rajaLessons.snapshot().length===2);
  assert.match(await page.locator('#lessonListCount').textContent(),/2 من 50/);
  const ids=await page.evaluate(()=>window.rajaLessons.snapshot().map(l=>l.id));const a=page.locator('[data-lesson-list="'+ids[0]+'"]'),b=page.locator('[data-lesson-list="'+ids[1]+'"]');
  await a.locator('input[type=file]').setInputFiles([{name:'01-first.wav',mimeType:'audio/wav',buffer:wav(40)},{name:'02-second.wav',mimeType:'audio/wav',buffer:wav(40)}]);
  await page.waitForFunction(()=>window.rajaLessons.snapshot()[0].items.length===2);
  await b.getByRole('combobox',{name:'درس من ملفاتي'}).selectOption({label:'01-first.wav'});await b.getByRole('button',{name:'إضافة من ملفاتي',exact:true}).click();
  await page.waitForFunction(()=>window.rajaLessons.snapshot()[1].items.length===1);
  await a.locator('.lesson-options>summary').click();await a.getByRole('button',{name:'تغيير موضع الاستماع',exact:true}).click();let form=a.locator('[data-today-editor]');const time=()=>form.getByRole('textbox',{name:'موضع الاستماع'});
  await time().fill('0:99');await form.getByRole('button',{name:'حفظ موضع الاستماع',exact:true}).click();assert.match(await form.getByRole('status').textContent(),/وقتًا صحيحًا/);
  await form.getByRole('button',{name:'المقطع التالي',exact:true}).click();await time().fill('0:45');await form.getByRole('button',{name:'حفظ موضع الاستماع',exact:true}).click();await form.getByRole('status').filter({hasText:'قبل نهاية المقطع'}).waitFor();
  await time().fill('٠:١٢');await form.getByRole('button',{name:'حفظ موضع الاستماع',exact:true}).click();await form.waitFor({state:'hidden'});
  let list=await page.evaluate(()=>window.rajaLessons.snapshot()[0]);assert.equal(list.cursor.id,list.items[1].id);assert.equal(list.cursor.offset,12);assert.equal(list.day.listened,0);
  await a.getByRole('button',{name:'متابعة',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=12&&!document.querySelector('#lessonAudio').paused);
  await page.locator('#recorderPlay').click();await page.locator('#recorderMenu').click();
  await a.locator('.lesson-tracks>summary').click();await a.locator('.lesson-row').first().locator('.lesson-track-options>summary').click();await a.locator('.lesson-row').first().getByRole('button',{name:'تغيير الموضع',exact:true}).click();form=a.locator('[data-today-editor]');await time().fill('0:08');
  await form.getByRole('button',{name:'تقديم 10 ثوانٍ',exact:true}).click();assert.equal(await time().inputValue(),'0:18');await form.getByRole('button',{name:'رجوع 10 ثوانٍ',exact:true}).click();
  await form.getByRole('button',{name:'حفظ موضع الاستماع',exact:true}).click();await form.waitFor({state:'hidden'});await page.locator('#recorderBack').click();
  assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),8);assert.equal(await page.locator('#lessonAudio').getAttribute('src'),null);
  await page.locator('#recorderList').selectOption(ids[1]);assert.equal(await page.evaluate(()=>window.rajaLessons.state().name),'قائمة التفسير');
  await page.locator('#recorderPlay').click();await page.waitForFunction(()=>!document.querySelector('#lessonAudio').paused&&document.querySelector('#lessonAudio').currentTime>0);
  await page.evaluate(()=>{const p=document.querySelector('#lessonAudio');p.currentTime=10;p.pause();p.dispatchEvent(new Event('timeupdate'));p.dispatchEvent(new Event('pause'))});
  await page.locator('#recorderList').selectOption(ids[0]);assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),8);
  await page.reload();await page.waitForFunction(()=>window.rajaLessons?.state()?.resumable);await page.waitForFunction(id=>document.querySelector('#recorderList').value===id,ids[0]);assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),8);
  await page.locator('#recorderList').selectOption(ids[1]);assert.ok(Math.abs(await page.evaluate(()=>window.rajaLessons.state().position)-10)<.5);
  await page.locator('#recorderList').selectOption(ids[0]);await page.locator('#recorderReplay').click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0&&!document.querySelector('#lessonAudio').paused);
  assert.ok(await page.locator('#lessonAudio').evaluate(e=>e.currentTime<2));
  await page.evaluate(()=>{document.addEventListener('loadedmetadata',e=>{if(e.target.id==='lessonAudio')e.target.playbackRate=16},true);document.querySelector('#lessonAudio').playbackRate=16});await page.waitForFunction(()=>window.rajaLessons.state().done,{},{timeout:12000});
  assert.ok(Math.abs(await page.locator('#lessonAudio').evaluate(e=>e.currentTime)-40)<.5,'open listening runs until the end of the list');
  assert.deepEqual(errors,[]);console.log('PASS multiple independent lists, picker persistence, manual position forward/back, Arabic time, invalid times, no autoplay, replay and open playback beyond the optional goal');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exit(1)});
