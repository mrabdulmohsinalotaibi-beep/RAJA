import {googleConfigured, cookie, STATE_COOKIE, SESSION_COOKIE, GOOGLE_CALLBACK, getCookie, expireCookie, unseal, seal, verifyGoogleIdToken} from '../../_lib/google-auth.js';
function failed(message) {
  return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تعذر تسجيل الدخول</title><body style="font:18px system-ui;background:#292929;color:white;padding:40px"><h1>تعذر تسجيل الدخول</h1><p>'+message+'</p><a href="/" style="color:#e4b476">العودة إلى رَجْع</a></body></html>',{status:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':expireCookie(STATE_COOKIE)}});
}
export async function onRequestGet({request,env}) {
  if(!googleConfigured(env))return failed('خدمة تسجيل Google غير مفعّلة.');
  const url=new URL(request.url);
  const state=url.searchParams.get('state')||'';
  const code=url.searchParams.get('code')||'';
  if(url.searchParams.has('error'))return failed('تم رفض تسجيل الدخول من Google.');
  if(!state || state.length>256 || !code || code.length>2048)return failed('بيانات تسجيل الدخول غير صالحة.');
  const stored=await unseal(getCookie(request,STATE_COOKIE),env.RAJA_SESSION_SECRET);
  const now=Math.floor(Date.now()/1000);
  if(!stored || stored.state!==state || !stored.nonce || !Number.isInteger(stored.exp) || stored.exp<now || stored.iat>now)return failed('انتهت صلاحية تسجيل الدخول أو لم يتطابق رمز الأمان.');
  let identity;
  try {
    const response=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,
        redirect_uri:GOOGLE_CALLBACK,grant_type:'authorization_code'
      })
    });
    if(!response.ok)throw Error('google_token_exchange_failed');
    const json=await response.json();
    identity=await verifyGoogleIdToken(json.id_token,env.GOOGLE_CLIENT_ID,stored.nonce);
  }catch{return failed('لم نتمكن من التحقق من حساب Google. أعد المحاولة.');}
  const session=await seal({iss:'raja-google',sub:identity.sub,email:identity.email,name:identity.name,iat:now,exp:now+7*86400},env.RAJA_SESSION_SECRET);
  const response=new Response(null,{status:303,headers:{Location:'https://raja.athat.app/'}});
  response.headers.append('Set-Cookie',cookie(SESSION_COOKIE,session,7*86400));
  response.headers.append('Set-Cookie',expireCookie(STATE_COOKIE));
  response.headers.set('Cache-Control','no-store');
  return response;
}
