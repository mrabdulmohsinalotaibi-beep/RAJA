/* Email + password account flow, matching ATHAT's method with independent RAJA accounts. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);let mode='login';
function message(text,bad=false){$('passwordAuthStatus').textContent=text;$('passwordAuthStatus').style.color=bad?'#9c363d':'#31634d'}
function switchMode(next){
 mode=next;const register=mode==='register',reset=mode==='reset';
 $('passwordNameLabel').hidden=!register;$('passwordName').required=register;
 $('passwordConfirmLabel').hidden=mode==='login';$('passwordConfirm').required=mode!=='login';
 $('passwordHint').hidden=mode==='login';$('passwordRecoveryInputLabel').hidden=!reset;$('passwordRecoveryInput').required=reset;
 $('passwordEntryLabel').textContent=reset?'كلمة المرور الجديدة':'كلمة المرور';$('passwordEntry').minLength=mode==='login'?1:12;
 $('passwordEntry').autocomplete=mode==='login'?'current-password':'new-password';
 $('passwordEntry').value='';$('passwordConfirm').value='';$('passwordRecoveryInput').value='';
 $('passwordAuthSubmit').textContent=register?'إنشاء حساب':reset?'استعادة الحساب':'تسجيل الدخول';
 $('passwordLoginMode').setAttribute('aria-pressed',String(mode==='login'));$('passwordRegisterMode').setAttribute('aria-pressed',String(register));
 $('passwordForgot').hidden=reset;message(reset?'أدخل رمز الاستعادة الذي حفظته عند إنشاء الحساب، وكلمة مرور جديدة.':'');
}
$('passwordLoginMode').onclick=()=>switchMode('login');$('passwordRegisterMode').onclick=()=>switchMode('register');$('passwordForgot').onclick=()=>switchMode('reset');
$('passwordReveal').onclick=()=>{
 const visible=$('passwordEntry').type==='password';$('passwordEntry').type=visible?'text':'password';$('passwordConfirm').type=visible?'text':'password';
 $('passwordReveal').textContent=visible?'إخفاء كلمة المرور':'إظهار كلمة المرور';
};
$('passwordAuthForm').onsubmit=async e=>{
 e.preventDefault();if(mode!=='login'&&$('passwordEntry').value!==$('passwordConfirm').value)return message('كلمتا المرور غير متطابقتين.',true);
 const button=$('passwordAuthSubmit');button.disabled=true;message('جارٍ إكمال الطلب...');
 try{
  const body={identity:$('passwordEmail').value.trim(),password:$('passwordEntry').value};
  if(mode==='register')body.name=$('passwordName').value.trim();if(mode==='reset')body.recoveryCode=$('passwordRecoveryInput').value.trim();
  const endpoint=mode==='register'?'register':mode==='reset'?'reset-password':'password-login';
  const response=await fetch('/api/auth/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message||'تعذر إكمال الطلب.');
  $('passwordEntry').value='';$('passwordConfirm').value='';$('passwordRecoveryInput').value='';
  if(result.recoveryCode){
   $('passwordRecoveryCode').value=result.recoveryCode;$('passwordRecoveryPanel').hidden=false;$('passwordAuthForm').hidden=true;$('passwordModeTabs').hidden=true;
   message(mode==='reset'?'تمت استعادة حسابك وإلغاء الجلسات السابقة. احفظ رمز الاستعادة الجديد.':'أُنشئ حسابك بنجاح. احفظ رمز الاستعادة قبل المتابعة.');
  }else location.replace('/');
 }catch(error){message(error.message||'تعذر الاتصال. حاول لاحقًا.',true)}finally{button.disabled=false}
};
$('passwordContinue').onclick=()=>location.replace('/');
$('passwordSaveRecovery').onclick=()=>{
 const text='رَجْع — رمز استعادة الحساب\nالجوال أو البريد: '+$('passwordEmail').value.trim()+'\nالرمز: '+$('passwordRecoveryCode').value+'\nاحتفظ به في مكان آمن. لا تشاركه مع الآخرين.\n';
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='raja-account-recovery.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 message('أُرسل ملف رمز الاستعادة إلى تنزيلات جهازك.');
};
})();
