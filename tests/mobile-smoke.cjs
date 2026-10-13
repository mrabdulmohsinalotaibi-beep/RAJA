const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.env.RAJA_URL || 'https://raja.athat.app/';
const ID = 'dQw4w9WgXcQ';
const EXAMPLE = 'https://youtu.be/' + ID + '?si=example';
const bytes = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftypisom', 'ascii'),
  Buffer.from([0,0,2,0]),
  Buffer.from('isomiso2', 'ascii'),
  Buffer.alloc(32, 0)
]);
const debug = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({
    viewport: {width:390,height:844},
    deviceScaleFactor:1,
    isMobile:true,
    hasTouch:true,
    acceptDownloads:true,
    serviceWorkers:'block'
  });
  const page = await context.newPage();
  page.on('request', request => { if(request.url().includes('/api/download')) console.log('DOWNLOAD_REQUEST',request.method(),request.url()); });
  page.on('response', response => { if(response.url().includes('/api/download')) console.log('DOWNLOAD_RESPONSE',response.status(),response.headers()['content-type']); });
  page.on('framenavigated', frame => { if(frame===page.mainFrame()) console.log('MAIN_FRAME_NAVIGATED',frame.url().slice(0,140)); });
  page.on('pageerror', e => debug.push(String(e)));
  page.on('console', msg => { if(msg.type()==='error' && !/youtube|thumbnail/i.test(msg.text())) debug.push(msg.text()); });
  page.on('requestfailed', req => {
    if(req.url().includes('/api/')) debug.push('API request failed '+req.url());
  });
  await page.route('**/api/formats?*', async route => {
    const body={
      ok:true,title:'RAJA automated test video',duration:15,provider:'raja-test-proxy',
      streams:[
        {index:0,format:'mp4',kind:'video',quality:'360',backend:true},
        {index:1,format:'mp4',kind:'video',quality:'720',backend:true},
        {index:2,format:'mp3',kind:'audio',quality:'192',backend:true}
      ]
    };
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.route('**/api/download?*', async route => {
    const u=new URL(route.request().url());
    const mp3=u.searchParams.get('format')==='mp3';
    const body=mp3?Buffer.concat([Buffer.from('ID3'),Buffer.alloc(45,4)]):bytes;
    await route.fulfill({
      status:200,
      headers:{
        'Content-Type':mp3?'audio/mpeg':'video/mp4',
        'Content-Length':String(body.byteLength),
        'Content-Disposition':'attachment; filename="raja-'+ID+'.'+(mp3?'mp3':'mp4')+'"',
        'Cache-Control':'no-store'
      },
      body
    });
  });
  console.log('TEST: Mobile layout and four tabs');
  await page.goto(BASE, {waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(() => document.querySelector('#check')?.getAttribute('aria-label')==='عرض صيغ الفيديو والصوت',{timeout:20000});
  assert.equal(await page.locator('[data-tab-button]').count(),4);
  const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(overflow.width<=overflow.viewport+2,'horizontal overflow: '+JSON.stringify(overflow));
  for(const tab of ['files','downloads','settings','search']){
    await page.locator('[data-tab-button="'+tab+'"]').click();
    assert.equal(await page.locator('[data-tab-panel="'+tab+'"]').isVisible(),true,'tab '+tab+' not visible');
  }
  console.log('PASS: Tabs, viewport, mobile navigation');

  console.log('TEST: Shared YouTube link and format discovery');
  await page.locator('#url').fill(EXAMPLE);
  await page.locator('#check').click();
  await page.locator('#formatButtons button').first().waitFor({state:'visible',timeout:25000});
  assert.equal(await page.locator('#formatButtons button').count(),3);
  assert.equal(await page.locator('#formatDownload').isEnabled(),true);
  const chosen=await page.locator('#formatButtons button.chosen').textContent();
  assert.match(chosen,/720/,'720p default not chosen');
  console.log('PASS: Format UI shows real choices');

  console.log('TEST: Direct MP4 download to device');
  const downloadEvent=page.waitForEvent('download',{timeout:25000});
  await page.locator('#formatDownload').click();
  const downloaded=await downloadEvent;
  assert.match(downloaded.suggestedFilename(),/\.mp4$/i);
  const dlPath=await downloaded.path();
  assert.ok(dlPath,'downloaded file path missing');
  console.log('PASS: Browser accepted attachment '+downloaded.suggestedFilename());

  console.log('TEST: Save directly inside device-only library, with progress');
  await page.locator('#formatKeep').click();
  await page.waitForFunction(()=>document.querySelector('#localStatus')?.textContent?.includes('تم تنزيل'),{timeout:35000});
  const libraryText=await page.locator('#localItems').innerText();
  assert.match(libraryText,/raja-dQw4w9WgXcQ\.mp4/i);
  assert.equal(await page.locator('[data-tab-panel="files"]').isVisible(),true);
  assert.equal(await page.locator('#localDownloadProgress').evaluate(x=>x.value),100);
  console.log('PASS: File in IndexedDB local library and 100% progress');

  console.log('TEST: MP3 option and file export');
  await page.locator('[data-tab-button="search"]').click();
  await page.locator('#formatButtons button').filter({hasText:'MP3'}).click();
  const a=page.waitForEvent('download',{timeout:25000});
  await page.locator('#formatDownload').click();
  const audio=await a;
  assert.match(audio.suggestedFilename(),/\.mp3$/i);
  console.log('PASS: MP3 download attachment');

  console.log('TEST: Search, file playback buttons, and history');
  await page.locator('[data-tab-button="files"]').click();
  await page.locator('#localSearch').fill('raja-');
  assert.ok((await page.locator('#localItems').innerText()).includes('mp4'));
  await page.locator('[data-tab-button="downloads"]').click();
  assert.ok((await page.locator('#recentDownloads').innerText()).includes('MP4'));
  assert.ok((await page.locator('#recentDownloads').innerText()).includes('MP3'));
  console.log('PASS: Download requests and on-device file list');

  console.log('TEST: Share target URL');
  const share=BASE+'?text='+encodeURIComponent('شاهد هذا المقطع '+EXAMPLE);
  await page.goto(share,{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForFunction(()=>document.querySelector('#url')?.value?.includes(ID),{timeout:15000});
  assert.ok((await page.locator('#url').inputValue()).includes(ID));
  console.log('PASS: Shared YouTube URL placed into downloader');

  const jsErrors=debug.filter(x=>!/abort|net::ERR_BLOCKED_BY_CLIENT|youtube-nocookie/i.test(x));
  assert.deepEqual(jsErrors,[],'Browser errors: '+JSON.stringify(jsErrors));
  console.log('ALL RAJA MOBILE E2E TESTS PASSED');
  await context.close();
  await browser.close();
}
main().catch(err=>{console.error('RAJA MOBILE TEST FAILURE',err,debug);process.exit(1);});
