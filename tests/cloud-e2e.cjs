const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {setup,session}=require('./cloud-test-utils.cjs');
const tone=Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures/tone.mp3.base64'),'utf8').trim(),'base64');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn){for(let n=0;n<300;n++){if(await fn())return;await sleep(50)}throw Error('Timed out waiting for synchronized server state')}
(async()=>{
 const {db,env}=setup(),file=await import('../functions/api/cloud-file.js'),sync=await import('../functions/api/sync.js'),auth=await import('../functions/_lib/google-auth.js');
 const base='http://127.0.0.1:8769',errors=[],ranges=[];
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,base),chunks=[];for await(const chunk of req)chunks.push(chunk);
   const headers=new Headers(req.headers);if(headers.get('Origin')===base)headers.set('Origin','https://raja.athat.app');
   const request=new Request('https://raja.athat.app'+url.pathname+url.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   let response;
   if(url.pathname==='/api/auth/me')response=auth.json({configured:true,guestAllowed:true,user:await auth.currentUser(request,env),methods:{password:true,google:false,email:false,sms:false}});
   else if(url.pathname==='/api/organizer')response=auth.json({ok:false},503);
   else if(url.pathname==='/api/sync')response=await sync['onRequest'+({GET:'Get',PUT:'Put'}[req.method])]({request,env});
   else if(url.pathname==='/api/cloud-file'){if(headers.has('Range'))ranges.push(headers.get('Range'));response=await file['onRequest'+({GET:'Get',POST:'Post',PUT:'Put',DELETE:'Delete'}[req.method])]({request,env})}
   else{
    const filename=path.resolve(__dirname,'..','.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!filename.startsWith(path.resolve(__dirname,'..')+path.sep)||!fs.existsSync(filename)){res.writeHead(404);res.end();return}
    const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.jpeg':'image/jpeg','.svg':'image/svg+xml'}[path.extname(filename)]||'text/plain';
    response=new Response(fs.readFileSync(filename),{headers:{'Content-Type':mime}});
   }
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){errors.push(error.stack);res.writeHead(500);res.end('test server error')}
 });
 await new Promise(r=>server.listen(8769,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const cookieA=await session(env,'owner-a-12345'),cookieB=await session(env,'owner-b-12345');
  async function device(cookie){const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await c.addCookies([{name:'raja_session',value:cookie.split('=').slice(1).join('='),url:base}]);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());return {c,p}}
  const first=await device(cookieA);await first.p.goto(base);await first.p.locator('#recorderMenu').click();
  await first.p.locator('#lessonName').fill('قائمة بين الأجهزة');await first.p.locator('#lessonCreate button').click();
  await first.p.locator('.lesson-list summary').click();await first.p.locator('.lesson-list input[type=file]').setInputFiles({name:'درس مشترك.mp3',mimeType:'',buffer:tone});
  await waitFor(()=>db.prepare("SELECT count(*) n FROM raja_cloud_files WHERE subject='owner-a-12345' AND status='ready'").get().n===1);
  await waitFor(()=>{const row=db.prepare("SELECT data FROM raja_sync WHERE subject='owner-a-12345'").get();return row&&JSON.parse(row.data).lessons[0]?.items.length===1});
  const id=db.prepare("SELECT id FROM raja_cloud_files WHERE subject='owner-a-12345'").get().id;
  const second=await device(cookieA);await second.p.goto(base);await second.p.locator('#recorderMenu').click();
  await second.p.getByRole('heading',{name:'قائمة بين الأجهزة',exact:true}).waitFor();await second.p.getByRole('button',{name:'تشغيل حصة اليوم',exact:true}).click();
  await second.p.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  assert.ok(ranges.length>0,'cloud playback must support actual media range requests');
  const other=await device(cookieB);await other.p.goto(base);await other.p.locator('#recorderMenu').click();
  assert.equal(await other.p.locator('.lesson-row').count(),0);
  assert.equal((await other.p.request.get(base+'/api/cloud-file?id='+id)).status(),404);
  await second.p.locator('#recorderMenu').click();await second.p.getByRole('button',{name:'ملفاتي',exact:true}).click();
  await second.p.getByRole('button',{name:'حفظ دون إنترنت',exact:true}).click();await second.p.getByText('أصبح الملف متاحًا دون إنترنت على هذا الجهاز.',{exact:true}).waitFor();
  const cached=await second.p.evaluate(async id=>[...new Uint8Array(await (await window.rajaLibrary.rawBlob(id)).arrayBuffer())],id);assert.deepEqual(Buffer.from(cached),tone);
  await second.c.setOffline(true);
  await second.p.getByRole('button',{name:'القوائم',exact:true}).click();await second.p.getByRole('button',{name:'تعديل الإعدادات',exact:true}).click();
  await second.p.locator('.lesson-list form').first().getByLabel('اسم القائمة',{exact:true}).fill('تعديل دون إنترنت');await second.p.getByRole('button',{name:'حفظ الإعدادات',exact:true}).click();
  await second.p.getByRole('button',{name:'تشغيل حصة اليوم',exact:true}).click();await second.p.waitForFunction(()=>document.querySelector('#lessonAudio').currentTime>0);
  await second.c.setOffline(false);await second.p.evaluate(()=>window.rajaCloudSync.sync());
  await waitFor(()=>{const row=db.prepare("SELECT data FROM raja_sync WHERE subject='owner-a-12345'").get();return JSON.parse(row.data).lessons.some(l=>l.name==='تعديل دون إنترنت')});
  await first.p.evaluate(()=>window.rajaCloudSync.sync());
  await first.p.getByRole('heading',{name:'تعديل دون إنترنت',exact:true}).waitFor();
  // Deletion propagates without a stale device resurrecting the file.
  await first.p.getByRole('button',{name:'ملفاتي',exact:true}).click();await first.p.locator('#localItems .lib-item').getByRole('button',{name:'حذف',exact:true}).click();
  await waitFor(()=>db.prepare('SELECT status FROM raja_cloud_files WHERE id=?').get(id).status==='deleted');
  await second.p.evaluate(()=>window.rajaCloudSync.sync());await waitFor(async()=>!(await second.p.evaluate(()=>window.rajaLibrary.items())).some(x=>x.id===id));
  // Existing anonymous data is imported only through the explicit account action.
  const guestContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),guest=await guestContext.newPage();guest.on('dialog',d=>d.accept());guest.on('pageerror',e=>errors.push(e.message));
  await guest.goto(base);await guest.locator('#recorderMenu').click();await guest.locator('#lessonName').fill('مكتبة الضيف السابقة');await guest.locator('#lessonCreate button').click();await guest.locator('.lesson-list summary').click();
  await guest.locator('.lesson-list input[type=file]').setInputFiles({name:'ملف الضيف.mp3',mimeType:'audio/mpeg',buffer:tone});await guest.locator('.lesson-row').waitFor();
  await guestContext.addCookies([{name:'raja_session',value:cookieA.split('=').slice(1).join('='),url:base}]);await guest.reload();await guest.locator('#recorderMenu').click();await guest.getByRole('button',{name:'ملفاتي',exact:true}).click();
  assert.equal(await guest.locator('#localItems').getByText('ملف الضيف.mp3',{exact:true}).count(),0);
  await guest.locator('#importGuestLibrary').click();
  await waitFor(()=>db.prepare("SELECT count(*) n FROM raja_cloud_files WHERE subject='owner-a-12345' AND name='ملف الضيف.mp3' AND status='ready'").get().n===1);
  const guestStillExists=await guest.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('raja-local-library');r.onsuccess=()=>{const q=r.result.transaction('items').objectStore('items').count();q.onsuccess=()=>{r.result.close();resolve(q.result)};q.onerror=()=>reject(q.error)}}));assert.equal(guestStillExists,1);
  assert.deepEqual(errors,[]);
  console.log('PASS two independent devices: automatic file/list upload, private cloud playback with ranges, exact offline cache, offline edits/reconnect, propagation and account isolation');
 }finally{await browser?.close();await new Promise(r=>server.close(r));db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
