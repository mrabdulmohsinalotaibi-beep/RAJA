import {googleConfigured, cookie, STATE_COOKIE, GOOGLE_CALLBACK, randomToken, seal, json} from '../../_lib/google-auth.js';
export async function onRequestGet({env}) {
  if (!googleConfigured(env)) return json({ok:false,error:'google_oauth_not_configured',message:'لم يتم إعداد Google OAuth بعد.'},503);
  const state=randomToken(), nonce=randomToken();
  const now=Math.floor(Date.now()/1000);
  const session=await seal({state,nonce,iat:now,exp:now+600},env.RAJA_SESSION_SECRET);
  const params=new URLSearchParams({
    client_id:env.GOOGLE_CLIENT_ID,
    redirect_uri:GOOGLE_CALLBACK,
    response_type:'code',
    scope:'openid email profile',
    state,nonce,
    prompt:'select_account',
    access_type:'online'
  });
  const response=new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params}});
  response.headers.set('Set-Cookie',cookie(STATE_COOKIE,session,600));
  response.headers.set('Cache-Control','no-store');
  return response;
}
