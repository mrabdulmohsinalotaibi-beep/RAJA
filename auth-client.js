/* RAJA Google OAuth interface. It never receives Google passwords, refresh tokens or YouTube cookies. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const status=$('rajaAuthStatus'),gate=$('rajaAuthGate'),account=$('rajaAccount');
  const login=$('rajaGoogleLogin'),logout=$('rajaLogout');
  const info=$('rajaAuthInfo');
  let state={configured:false,user:null};
  const ready=async()=>{
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'});
      if(!r.ok)throw Error('server_error');
      const json=await r.json();
      state={configured:json.configured===true,user:json.user||null};
    }catch{
      state={configured:true,user:null,error:'auth_service_unavailable'};
      document.documentElement.classList.add('raja-auth-required');
      gate.hidden=false;
      account.hidden=true;
      status.textContent='تعذر التحقق من حالة تسجيل Google.';
      info.textContent='خدمة تسجيل الدخول غير متاحة الآن؛ حاول تحديث الصفحة لاحقًا.';
      login.href='/api/auth/login';
      return state;
    }
    document.documentElement.classList.toggle('raja-auth-required',state.configured&&!state.user);
    gate.hidden=!(state.configured&&!state.user);
    if(state.configured && state.user){
      account.hidden=false;
      $('rajaAccountName').textContent=state.user.name||state.user.email;
      $('rajaAccountEmail').textContent=state.user.email;
      status.textContent='حساب Google متصل';
    } else if(state.configured){
      account.hidden=true;
      status.textContent='تسجيل الدخول مطلوب';
      info.textContent='سجّل الدخول بحساب Google الخاص بك للوصول إلى خدمات رَجْع. لا نطلب كلمة مرور Google أو أذونات YouTube.';
    } else {
      account.hidden=true;
      status.textContent='الدخول التجريبي مفتوح';
      info.textContent='لم تُفعّل خدمة تسجيل Google بعد. ستظهر شاشة الدخول عند تهيئة إعدادات Google OAuth.';
    }
    login.href='/api/auth/login';
    return state;
  };
  window.rajaAuthReady=ready();
  window.rajaAuthState=()=>state;
  logout.addEventListener('click',async()=>{
    logout.disabled=true;
    try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}
    catch{}
    // Reload to ensure the next user gets a distinct local IndexedDB namespace.
    location.replace('/');
  });
})();
