const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function wav(seconds){
 const samples=8000*seconds,b=Buffer.alloc(44+samples*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);return b;
}
(async()=>{
 const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});
 let browser;
 try{
  await delay(700);
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:false,user:null}}));
  await page.addInitScript(()=>{
   window.lessonTestNow=Date.parse('2026-10-14T03:00:00Z');Date.now=()=>window.lessonTestNow;
   document.addEventListener('loadedmetadata',e=>{if(e.target.id==='lessonAudio')e.target.playbackRate=16},true);
  });
  await page.goto('http://127.0.0.1:8766');
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:768,height:1024}]){
   await page.setViewportSize(viewport);
   assert.ok(await page.locator('main').evaluate(e=>e.scrollHeight<=e.clientHeight+2),'fixed home must fit '+JSON.stringify(viewport));
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#recorderMenu').click();
  await page.locator('#lessonName').fill('دروس الاختبار');await page.locator('#lessonMinutes').fill('1');
  await page.locator('#lessonCreate button').click();
  const list=page.locator('.lesson-list');await list.locator('summary').click();
  await list.locator('input[type="file"]').setInputFiles([
   {name:'02-second.wav',mimeType:'audio/wav',buffer:wav(40)},
   {name:'01-first.wav',mimeType:'audio/wav',buffer:wav(40)}
  ]);
  await page.waitForFunction(()=>document.querySelectorAll('.lesson-row').length===2);
  assert.match(await page.locator('.lesson-row strong').first().textContent(),/01-first/);
  page.on('dialog',d=>d.accept());
  await page.getByRole('button',{name:'تقديم 02-second.wav',exact:true}).click();
  assert.match(await page.locator('.lesson-row strong').first().textContent(),/02-second/);
  await page.getByRole('button',{name:'تقديم 01-first.wav',exact:true}).click();
  assert.match(await page.locator('.lesson-row strong').first().textContent(),/01-first/);
  await page.getByRole('button',{name:'تشغيل حصة اليوم',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  // Navigation must not stop the ongoing audio element.
  await page.locator('#recorderMenu').click();await page.locator('[data-tab-button="settings"]').click();
  assert.equal(await page.locator('#lessonAudio').evaluate(e=>e.paused),false);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('raja-lessons-v1-local'))[0].day.furthest>=60,{},{timeout:15000});
  let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('raja-lessons-v1-local'))[0]);
  assert.equal(stored.day.furthest,60);assert.equal(stored.cursor.offset,20);
  assert.equal(stored.cursor.id,stored.items[1].id);
  if(await page.locator('#recorderBack').isVisible())await page.locator('#recorderBack').click();
  await page.locator('#recorderReplay').click();
  await page.waitForFunction(()=>document.querySelector('#lessonNowTitle').textContent.includes('01-first'));
  await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  assert.ok(await page.locator('#lessonAudio').evaluate(e=>e.currentTime)<20);
  stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('raja-lessons-v1-local'))[0]);
  assert.equal(stored.day.start.id,stored.items[0].id);
  await page.locator('#recorderPlay').click();
  await page.evaluate(()=>{window.lessonTestNow+=86400000});
  if(await page.locator('#recorderBack').isVisible())await page.locator('#recorderBack').click();
  await page.locator('#recorderReplay').click();
  await page.waitForFunction(()=>document.querySelector('#lessonNowTitle').textContent.includes('02-second'));
  await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=20);
  stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('raja-lessons-v1-local'))[0]);
  assert.equal(stored.day.key,'2026-10-15');assert.equal(stored.day.start.offset,20);
  await page.evaluate(()=>window.rajaLessons.stop());
  await page.reload();await page.locator('#recorderMenu').click();
  await page.waitForFunction(()=>document.querySelectorAll('.lesson-row').length===2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS mobile lesson import, natural ordering, reorder, sequential playback, daily cutoff, navigation, replay, day rollover, persistence, layout');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
