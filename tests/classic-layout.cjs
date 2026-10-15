const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=spawn('python3',['-m','http.server','8771','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,600));browser=await chromium.launch({headless:true});
  const page=await browser.newPage({serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:false,user:null}}));
  await page.goto('http://127.0.0.1:8771');await page.waitForFunction(()=>window.rajaLessons);
  fs.mkdirSync('layout-previews',{recursive:true});
  for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1440,900]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>{document.querySelector('#recorderTitle').textContent='شرح زاد المستقنع — الدرس الأول في أحكام الطهارة والصلاة'});
   const result=await page.evaluate(()=>{
    const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
    return {overflow:document.documentElement.scrollWidth>innerWidth,mainOverflow:document.querySelector('main').scrollHeight>document.querySelector('main').clientHeight+2,
     pieces:['.raja-top','.recorder-status','.recorder-display','.recorder-media','.recorder-controls','.recorder-replay','.recorder-summary','#recorderMessage','.recorder-footer'].map(box),footer:box('.recorder-footer'),height:innerHeight,display:box('.recorder-display'),time:box('.recorder-time'),
     buttons:[...document.querySelectorAll('.recorder-controls button')].map(b=>({w:b.offsetWidth,h:b.offsetHeight}))};
   });
   assert.ok(result.time.bottom<=result.display.bottom-3,'display content spills '+width+'x'+height+': '+JSON.stringify(result));
   assert.equal(result.overflow,false,'horizontal overflow '+width+'x'+height);
   assert.equal(result.mainOverflow,false,'main overflow '+width+'x'+height+': '+JSON.stringify(result));
   for(let i=1;i<result.pieces.length;i++)assert.ok(result.pieces[i].top>=result.pieces[i-1].bottom-1,'overlap '+width+'x'+height+': '+JSON.stringify(result));
   assert.ok(result.footer.bottom<=height+1,'footer outside viewport');
   assert.ok(result.buttons.every(b=>b.w>=44&&b.h>=44),'transport touch targets');
   await page.screenshot({path:'layout-previews/recorder-'+width+'.png'});
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#recorderMenu').click();
  await page.locator('#lessonName').fill('دروس الفقه');await page.locator('#lessonCreate button').click();
  await page.screenshot({path:'layout-previews/library.png'});
  for(const tab of ['organizer','files','search','settings']){
   await page.locator('[data-tab-button="'+tab+'"]').click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'management overflow '+tab);
   assert.ok(await page.locator('#recorderBack').isVisible());
  }
  await page.locator('#recorderBack').click();assert.ok(await page.locator('#recorderScreen').isVisible());
  assert.deepEqual(errors,[]);console.log('PASS classic recorder: seven viewports, long titles, no overlaps, visible footer, touch targets and management navigation');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exit(1)});
