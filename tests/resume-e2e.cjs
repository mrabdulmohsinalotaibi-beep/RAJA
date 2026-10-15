const {chromium}=require('playwright'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path');
let wavNonce=0;
function wav(seconds){const n=8000*seconds,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);b.writeInt16LE(++wavNonce,44);return b}
(async()=>{
 const server=spawn('python3',['-m','http.server','8770','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,500));browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:false,user:null}}));
  await page.goto('http://127.0.0.1:8770');await page.locator('#recorderMenu').click();
  await page.locator('#lessonName').fill('متابعة الدروس');await page.locator('#lessonMinutes').fill('1');await page.locator('#lessonPartMinutes').fill('0');await page.locator('#lessonCreate button').click();
  await page.locator('.lesson-list input[type=file]').setInputFiles([{name:'01-first.wav',mimeType:'audio/wav',buffer:wav(40)},{name:'02-second.wav',mimeType:'audio/wav',buffer:wav(40)}]);
  await page.locator('.lesson-row').nth(1).waitFor({state:'attached'});await page.getByRole('button',{name:'تشغيل القائمة',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  async function pauseAt(t){await page.evaluate(t=>{const a=document.querySelector('#lessonAudio');a.currentTime=t;a.pause();a.dispatchEvent(new Event('timeupdate'));a.dispatchEvent(new Event('pause'))},t)}
  async function reloadReady(t){await page.reload();await page.waitForFunction(()=>window.rajaLessons?.state()?.resumable);const state=await page.evaluate(()=>window.rajaLessons.state());assert.ok(Math.abs(state.position-t)<0.15);assert.equal(state.playing,false);assert.equal(await page.locator('#lessonAudio').getAttribute('src'),null);await page.locator('#recorderSubtitle').filter({hasText:'جاهز للمتابعة'}).waitFor()}
  await pauseAt(13.25);await reloadReady(13.25);await page.locator('#recorderPlay').click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=13.2);assert.ok(await page.locator('#lessonAudio').evaluate(a=>a.currentTime)<15);
  // A rewind saves the last position rather than always restoring the furthest one.
  await pauseAt(5.5);await reloadReady(5.5);await page.locator('#recorderPlay').click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=5.5);
  await page.evaluate(()=>{const a=document.querySelector('#lessonAudio');a.currentTime=40;a.dispatchEvent(new Event('ended'))});await page.waitForFunction(()=>document.querySelector('#lessonNowTitle').textContent.includes('02-second')&&document.querySelector('#lessonAudio').currentTime>0);
  await pauseAt(12.5);await reloadReady(12.5);assert.equal((await page.evaluate(()=>window.rajaLessons.state())).index,2);assert.ok((await page.evaluate(()=>window.rajaLessons.state())).elapsed>=0);
  await page.locator('#recorderPlay').click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=12.5);await page.locator('#lessonAudio').evaluate(a=>a.playbackRate=16);
  await page.waitForFunction(()=>window.rajaLessons.state().done,{},{timeout:10000});assert.ok(Math.abs(await page.locator('#lessonAudio').evaluate(a=>a.currentTime)-40)<0.15);
  await page.locator('#recorderReplay').click();await page.waitForFunction(()=>document.querySelector('#lessonNowTitle').textContent.includes('02-second')&&document.querySelector('#lessonAudio').currentTime>0);assert.ok(await page.locator('#lessonAudio').evaluate(a=>a.currentTime)<5);
  // Direct library playback without any playlist also restores its last file.
  const c2=await browser.newContext({serviceWorkers:'block'}),p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));await p2.route('**/api/auth/me',r=>r.fulfill({json:{configured:false,user:null}}));await p2.goto('http://127.0.0.1:8770');await p2.locator('#recorderMenu').click();await p2.getByRole('button',{name:'ملفاتي',exact:true}).click();await p2.locator('#localImport').setInputFiles({name:'standalone.wav',mimeType:'audio/wav',buffer:wav(40)});await p2.getByRole('button',{name:'تشغيل',exact:true}).click();await p2.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  await p2.evaluate(()=>{const a=document.querySelector('#lessonAudio');a.currentTime=17;a.pause();a.dispatchEvent(new Event('timeupdate'))});await p2.reload();await p2.waitForFunction(()=>window.rajaLessons?.state()?.resumable);assert.equal((await p2.evaluate(()=>window.rajaLessons.state())).position,17);await p2.locator('#recorderPlay').click();await p2.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=17);
  assert.deepEqual(errors,[]);console.log('PASS reload restores ready paused position, rewinds, later tracks, open listening to the end, current-track replay and standalone library files');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
