const {chromium}=require('playwright'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
function wav(seconds){const b=Buffer.alloc(44+8000*seconds*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b}
(async()=>{
 const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,600));browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:false,user:null}}));
  await page.addInitScript(()=>{window.lessonTestNow=Date.parse('2026-10-15T03:00:00Z');Date.now=()=>window.lessonTestNow});
  await page.goto('http://127.0.0.1:8766');await page.locator('#recorderMenu').click();
  await page.locator('#lessonName').fill('دروس الفقه');assert.equal(await page.locator('#lessonMinutes').inputValue(),'0');
  await page.locator('#lessonFiles').setInputFiles([{name:'02-second.wav',mimeType:'audio/wav',buffer:wav(40)},{name:'01-first.wav',mimeType:'audio/wav',buffer:wav(40)}]);await page.locator('#lessonCreate button').click();
  await page.waitForFunction(()=>window.rajaLessons.snapshot()[0]?.items.length===2);assert.equal(await page.evaluate(()=>window.rajaLessons.state().minutes),0);
  const list=page.locator('.lesson-list');await list.locator('.lesson-tracks>summary').click();
  assert.match(await page.locator('.lesson-row strong').first().textContent(),/01-first/);
  // Reorder with a pointer handle, then with the keyboard-accessible controls.
  await page.locator('.lesson-drag').nth(1).scrollIntoViewIfNeeded();
  const source=await page.locator('.lesson-drag').nth(1).boundingBox(),target=await page.locator('.lesson-row').first().boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>window.rajaLessons.snapshot()[0].items[0].title==='02-second.wav');
  await list.locator('.lesson-tracks>summary').click();await page.locator('.lesson-row').nth(1).locator('.lesson-track-options>summary').click();await page.getByRole('button',{name:'تقديم 01-first.wav',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.rajaLessons.snapshot()[0].items[0].title),'01-first.wav');
  await list.getByRole('button',{name:'تشغيل القائمة',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  await page.locator('#recorderNext').click();await page.waitForFunction(()=>window.rajaLessons.state().index===2&&!document.querySelector('#lessonAudio').paused);
  await page.locator('#recorderPrevious').click();await page.waitForFunction(()=>window.rajaLessons.state().index===1&&!document.querySelector('#lessonAudio').paused);
  await page.evaluate(()=>window.rajaLessons.seek(35));assert.equal(await page.locator('#lessonAudio').evaluate(e=>e.currentTime),35);assert.ok((await page.evaluate(()=>window.rajaLessons.state())).elapsed<5,'seeking is not counted as listening');
  await page.evaluate(()=>{window.rajaLessons.seek(5);document.querySelector('#lessonAudio').pause()});
  await page.locator('#recorderMenu').click();assert.match(await list.locator('.lesson-where').textContent(),/01-first[\s\S]*0:05/);
  await list.locator('.lesson-tracks>summary').click();assert.match(await page.locator('.lesson-row').first().textContent(),/وصلت هنا/);assert.match(await page.locator('.lesson-row').nth(1).textContent(),/لم تبدأ بعد|توقفت عند/);
  // Updating a goal preserves position and does not impose a stop.
  await list.locator('.lesson-options>summary').click();await list.locator('.lesson-options input[type=number]').fill('1');await list.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),5);
  await list.getByRole('button',{name:'متابعة',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#lessonAudio').paused);
  await page.locator('#recorderReplay').click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime<2&&!document.querySelector('#lessonAudio').paused);
  await page.evaluate(()=>{document.addEventListener('loadedmetadata',e=>{if(e.target.id==='lessonAudio')e.target.playbackRate=16},true);document.querySelector('#lessonAudio').playbackRate=16});
  await page.waitForFunction(()=>window.rajaLessons.state().goalReached&&window.rajaLessons.state().playing,{},{timeout:12000});assert.equal(await page.evaluate(()=>window.rajaLessons.state().done),false);
  await page.locator('#recorderGoalText').filter({hasText:'أكملت هدف اليوم'}).waitFor();
  await page.waitForFunction(()=>window.rajaLessons.state().done,{},{timeout:12000});assert.ok(Math.abs(await page.locator('#lessonAudio').evaluate(e=>e.currentTime)-40)<.2);
  await page.locator('#recorderPrevious').click();await page.waitForFunction(()=>window.rajaLessons.state().index===1&&!document.querySelector('#lessonAudio').paused);await page.evaluate(()=>{document.querySelector('#lessonAudio').playbackRate=1;window.rajaLessons.seek(8);document.querySelector('#lessonAudio').pause()});
  await page.locator('#recorderMenu').click();await list.locator('.lesson-tracks>summary').click();assert.match(await page.locator('.lesson-row').nth(1).textContent(),/تم الاستماع/);
  fs.mkdirSync('layout-previews',{recursive:true});await page.screenshot({path:'layout-previews/open-playlists.png'});
  await page.reload();await page.waitForFunction(()=>window.rajaLessons?.state()?.resumable);assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),8);
  await page.evaluate(()=>{window.lessonTestNow+=86400000});assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),8);assert.equal(await page.evaluate(()=>window.rajaLessons.state().elapsed),0);
  await page.locator('#recorderPlay').click();await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>=8&&!document.querySelector('#lessonAudio').paused);await page.evaluate(()=>{window.rajaLessons.seek(8);window.rajaLessons.stop()});
  // Leave the app first so its pagehide save cannot overwrite the legacy fixture.
  await page.goto('http://127.0.0.1:8766/tests/fixtures/');
  // Migrating an old hard-limited checkpoint retains its exact position and switches to open mode.
  await page.evaluate(()=>{const key='raja-lessons-v1-local',lists=JSON.parse(localStorage.getItem(key)),l=lists[0];delete l.goalMinutes;delete l.openListeningVersion;l.minutes=1;l.day.key='2026-10-13';l.day.furthest=60;delete l.day.listened;localStorage.setItem(key,JSON.stringify(lists));const c=JSON.parse(localStorage.getItem(key+':positions'));c[l.id].dayKey='2026-10-13';c[l.id].done=true;localStorage.setItem(key+':positions',JSON.stringify(c))});
  await page.goto('http://127.0.0.1:8766');await page.waitForFunction(()=>window.rajaLessons?.state()?.resumable);assert.equal(await page.evaluate(()=>window.rajaLessons.state().position),8);assert.equal(await page.evaluate(()=>window.rajaLessons.state().minutes),0);
  assert.deepEqual(errors,[]);console.log('PASS bulk creation, natural order, pointer and keyboard reorder, arbitrary next/previous/seek, goal exceeded without pause, completion badges, exact cross-day resume and legacy checkpoint migration');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
