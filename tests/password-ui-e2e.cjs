const {chromium}=require('playwright');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const path=require('node:path');
(async()=>{
 const server=spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:'ignore'});let browser;
 try{
  await new Promise(r=>setTimeout(r,500));browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();let user=null;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const testUser={id:'account-test-only',name:'UI Tester',email:'tester@example.invalid',emailVerified:false};
  await page.route('**/api/auth/me',r=>r.fulfill({json:{configured:true,guestAllowed:true,user,methods:{password:true,google:false,email:false,sms:false}}}));
  await page.route('**/api/organizer',r=>r.fulfill({status:503,json:{ok:false}}));
  await page.route('**/api/auth/register',r=>{const body=r.request().postDataJSON();assert.equal(body.email,testUser.email);assert.equal(body.name,testUser.name);return r.fulfill({json:{ok:true,user:testUser,recoveryCode:'T'.repeat(32)}})});
  await page.route('**/api/auth/password-login',r=>{const body=r.request().postDataJSON();if(body.password==='wrong-password')return r.fulfill({status:401,json:{ok:false,message:'البريد الإلكتروني أو كلمة المرور غير صحيحة.'}});user=testUser;return r.fulfill({json:{ok:true,user}})});
  await page.route('**/api/auth/logout',r=>{user=null;return r.fulfill({json:{ok:true}})});
  await page.route('**/api/auth/reset-password',r=>r.fulfill({json:{ok:true,user:testUser,recoveryCode:'R'.repeat(32)}}));
  await page.goto('http://127.0.0.1:8767');await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'حسابي',exact:true}).click();
  await page.locator('#passwordAuth').waitFor({state:'visible'});assert.equal(await page.locator('#contactAuth').isVisible(),false);
  await page.locator('#passwordEmail').fill(testUser.email);await page.locator('#passwordEntry').fill('wrong-password');await page.locator('#passwordAuthSubmit').click();await page.getByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.',{exact:true}).waitFor();
  await page.locator('#passwordRegisterMode').click();await page.locator('#passwordName').fill(testUser.name);await page.locator('#passwordEntry').fill('ui-only-test-password-123');await page.locator('#passwordConfirm').fill('does-not-match-123');await page.locator('#passwordAuthSubmit').click();await page.getByText('كلمتا المرور غير متطابقتين.',{exact:true}).waitFor();
  await page.locator('#passwordConfirm').fill('ui-only-test-password-123');await page.locator('#passwordAuthSubmit').click();await page.locator('#passwordRecoveryPanel').waitFor({state:'visible'});assert.equal(await page.locator('#passwordRecoveryCode').inputValue(),'T'.repeat(32));
  assert.equal(await page.locator('#passwordEntry').inputValue(),'');assert.equal(await page.locator('#passwordConfirm').inputValue(),'');
  assert.ok(!await page.evaluate(()=>JSON.stringify(localStorage).includes('ui-only-test-password-123')));
  await page.reload();await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'حسابي',exact:true}).click();
  await page.locator('#passwordEmail').fill(testUser.email);await page.locator('#passwordEntry').fill('ui-only-test-password-123');await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#passwordAuthSubmit').click()]);
  await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'حسابي',exact:true}).click();await page.locator('#rajaAccount').waitFor({state:'visible'});assert.equal(await page.locator('#passwordAuth').isVisible(),false);
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#rajaLogout').click()]);await page.locator('#recorderMenu').waitFor({state:'visible'});await page.locator('#recorderMenu').click();await page.getByRole('button',{name:'حسابي',exact:true}).click();await page.locator('#passwordForgot').click();
  await page.locator('#passwordEmail').fill(testUser.email);await page.locator('#passwordRecoveryInput').fill('T'.repeat(32));await page.locator('#passwordEntry').fill('replacement-password-123');await page.locator('#passwordConfirm').fill('replacement-password-123');await page.locator('#passwordAuthSubmit').click();await page.locator('#passwordRecoveryPanel').waitFor({state:'visible'});assert.equal(await page.locator('#passwordRecoveryCode').inputValue(),'R'.repeat(32));
  assert.deepEqual(errors,[]);console.log('PASS email/password UI: login errors, registration, confirmation, recovery display, password clearing, session/account view, logout and recovery flow');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
