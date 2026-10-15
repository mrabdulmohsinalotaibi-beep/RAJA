const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const tone=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/tone.mp3.base64'),'utf8').trim(),'base64');
(async()=>{
 const server=spawn('python3',['-m','http.server','8768','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,500));
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await page.addInitScript(()=>{window.testAudioTypes=[];Object.defineProperty(navigator,'audioSession',{configurable:true,value:{set type(value){this.value=value;window.testAudioTypes.push(value)},get type(){return this.value}}})});
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:true,guestAllowed:true,user:null,methods:{password:true}}}));
  await page.goto('http://127.0.0.1:8768');
  await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'ملفاتي',exact:true}).click();
  assert.match(await page.locator('#localImport').getAttribute('accept'),/\.mp3/);
  await page.locator('#localImport').setInputFiles({name:'صوت من الجهاز.MP3',mimeType:'application/octet-stream',buffer:tone});
  await page.getByText('صوت من الجهاز.MP3',{exact:true}).waitFor();
  await page.reload();await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'ملفاتي',exact:true}).click();
  await page.getByText('صوت من الجهاز.MP3',{exact:true}).waitFor();
  const stored=await page.evaluate(async()=>{const [item]=await window.rajaLibrary.items();const blob=await window.rajaLibrary.getBlob(item.id);return {mime:blob.type,bytes:[...new Uint8Array(await blob.arrayBuffer())]}});
  assert.equal(stored.mime,'audio/mpeg');assert.deepEqual(Buffer.from(stored.bytes),tone);
  await page.getByRole('button',{name:'تشغيل',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  assert.equal(await page.locator('#lessonVideo').evaluate(e=>e.hidden),true);
  const nativeResume=await page.evaluate(async()=>{
   const audio=document.querySelector('#lessonAudio'),source=audio.currentSrc,checks=[];
   for(let i=0;i<3;i++){audio.pause();const at=audio.currentTime;await new Promise(r=>setTimeout(r,100));await audio.play();await new Promise(r=>setTimeout(r,20));checks.push({categories:window.testAudioTypes.slice(-2).join(','),source:audio.currentSrc===source,position:Math.abs(audio.currentTime-at)<0.15,playing:!audio.paused})}
   return checks;
  });
  for(const check of nativeResume)assert.deepEqual(check,{categories:'ambient,playback',source:true,position:true,playing:true});

  await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'القوائم',exact:true}).click();
  await page.locator('#lessonName').fill('قائمة MP3');await page.locator('#lessonCreate button').click();

  await page.locator('.lesson-list input[type=file]').setInputFiles({name:'درس بدون نوع.mp3',mimeType:'',buffer:tone});
  await page.locator('.lesson-row strong').waitFor({state:'attached'});
  assert.match(await page.locator('#lessonStatus').textContent(),/تمت إضافة 1/);
  await page.getByRole('button',{name:'تشغيل القائمة',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  await page.reload();await page.locator('#recorderMenu').click();
  await page.locator('.lesson-add>summary').click();
  // A storage failure must be visible in the same playlist screen.
  await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(mode==='readwrite')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,stores,mode,...rest)}});
  await page.locator('.lesson-list input[type=file]').setInputFiles({name:'لن يحفظ.mp3',mimeType:'audio/mpeg',buffer:tone});
  await page.locator('#lessonStatus').filter({hasText:'لن يحفظ.mp3: لا توجد مساحة'}).waitFor();
  assert.equal(await page.locator('.lesson-row').count(),1);
  await page.reload();await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'التحميل',exact:true}).click();
  await page.locator('details').filter({has:page.locator('#file')}).locator('summary').click();
  await page.locator('#file').setInputFiles({name:'تشغيل مباشر.mp3',mimeType:'application/octet-stream',buffer:tone});
  await page.waitForFunction(()=>document.querySelector('#lessonNowTitle').textContent.includes('تشغيل مباشر.mp3')&&document.querySelector('#lessonAudio').currentTime>0);
  assert.deepEqual(errors,[]);
  console.log('PASS real MP3 import with missing/generic MIME, byte-exact persistent Blob, native audio playback, playlist import and visible storage failures');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
