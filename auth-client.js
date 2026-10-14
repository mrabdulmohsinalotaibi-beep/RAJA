/* Contact verification and Google sign-in. Provider secrets never reach this client. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let state={configured:false,user:null,methods:{password:false,google:false,email:false,sms:false}},channel='email',checking=false;
const gate=$('rajaAuthGate');
gate.className='card';$('contactAuth').after(gate);
function status(message,bad=false){$('contactAuthStatus').textContent=message;$('contactAuthStatus').style.color=bad?'#9c363d':'#31634d'}
function reset(){
 checking=false;$('contactCodeLabel').hidden=true;$('contactAuthCode').required=false;
 $('contactAuthIdentity').readOnly=false;$('contactAuthCode').value='';$('contactAuthSubmit').textContent='متابعة';$('contactAuthChange').hidden=true;
}
function method(value){
 channel=value;reset();
 const phone=channel==='sms';$('contactAuthLabel').textContent=phone?'رقم الجوال':'البريد الإلكتروني';
 const input=$('contactAuthIdentity');input.type=phone?'tel':'email';input.autocomplete=phone?'tel':'email';input.placeholder=phone?'05XXXXXXXX':'name@example.com';input.value='';
 for(const b of document.querySelectorAll('[data-auth-channel]'))b.setAttribute('aria-pressed',String(b.dataset.authChannel===channel));
 status(state.methods[channel]?'':'الدخول '+(phone?'بالجوال':'بالبريد')+' غير مفعّل بعد؛ يلزم ربط مزود التحقق.');
}
for(const button of document.querySelectorAll('[data-auth-channel]'))button.onclick=()=>method(button.dataset.authChannel);
$('contactAuthChange').onclick=()=>{reset();status('يمكنك تعديل بياناتك ثم طلب رمز جديد.')};
const ready=async()=>{
 try{
  const response=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw Error();
  const data=await response.json();
  state={configured:data.configured===true,guestAllowed:data.guestAllowed===true,user:data.user||null,methods:data.methods||{google:data.configured===true,email:false,sms:false}};
 }catch{
  state={configured:true,user:null,methods:{password:false,google:false,email:false,sms:false},error:true};
 }
 $('rajaAccount').hidden=!state.user;$('contactAuth').hidden=!!state.user||(!state.methods.email&&!state.methods.sms);
 $('passwordAuth').hidden=!!state.user||!state.methods.password;gate.hidden=!state.methods.google||!!state.user;
 if(state.user){
  $('rajaAccountName').textContent=state.user.name||'حسابك في رَجْع';$('rajaAccountEmail').textContent=state.user.email||state.user.phone||'';
  $('rajaAuthStatus').textContent='تم تسجيل الدخول';$('rajaAuthInfo').textContent='مكتبتك الشخصية منفصلة عن الحسابات الأخرى على الجهاز.';
 }else{
  $('rajaAuthStatus').textContent=state.error?'تعذر التحقق من خدمة الدخول':state.methods.password?'الدخول بالبريد وكلمة المرور متاح':'المكتبة المحلية متاحة';
  $('rajaAuthInfo').textContent=state.methods.password?'سجل الدخول أو أنشئ حسابًا جديدًا. ويمكنك متابعة مكتبة هذا الجهاز دون تسجيل دخول.':state.configured?'سجل الدخول إلى حسابك للوصول إلى مكتبتك.':'يمكنك استخدام مكتبة الجهاز الآن.';
  if(state.configured&&!state.guestAllowed){window.rajaSwitchTab?.('settings')}
 }
 document.documentElement.classList.toggle('raja-auth-required',state.configured&&!state.user&&!state.guestAllowed);
 method(channel);return state;
};
window.rajaAuthReady=ready();window.rajaAuthState=()=>state;
$('contactAuthForm').onsubmit=async e=>{
 e.preventDefault();if(!state.methods[channel])return status('طريقة الدخول هذه غير مفعّلة حاليًا. يلزم ربط مزود التحقق.',true);
 const submit=$('contactAuthSubmit');submit.disabled=true;
 try{
  const payload={channel,identity:$('contactAuthIdentity').value.trim()};if(checking)payload.code=$('contactAuthCode').value.trim();
  const response=await fetch('/api/auth/'+(checking?'check-code':'send-code'),{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message||'تعذرت عملية الدخول.');
  if(checking){location.replace('/');return}
  checking=true;$('contactCodeLabel').hidden=false;$('contactAuthCode').required=true;$('contactAuthIdentity').readOnly=true;
  submit.textContent='تحقق وادخل';$('contactAuthChange').hidden=false;status(result.message||'أُرسل رمز التحقق.');$('contactAuthCode').focus();
 }catch(error){status(error.message||'تعذر الاتصال بخدمة الدخول.',true)}finally{submit.disabled=false}
};
$('rajaLogout').onclick=async()=>{
 const b=$('rajaLogout');b.disabled=true;
 try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error();location.replace('/')}
 catch{$('rajaAuthInfo').textContent='تعذر تسجيل الخروج. أعد المحاولة.';b.disabled=false}
};
})();
