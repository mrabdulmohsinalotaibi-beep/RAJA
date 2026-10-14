import {SESSION_COOKIE,STATE_COOKIE,expireCookie,json,userOriginAllowed,unseal,getCookie} from '../../_lib/google-auth.js';
export async function onRequestPost({request,env}) {
  if(!userOriginAllowed(request))return json({ok:false,error:'invalid_origin'},403);
  if(env?.RAJA_DB&&env?.RAJA_SESSION_SECRET){
    const payload=await unseal(getCookie(request,SESSION_COOKIE),env.RAJA_SESSION_SECRET);
    if(payload?.iss==='raja-password'&&payload.sid&&payload.sub){
      try{await env.RAJA_DB.prepare('DELETE FROM raja_password_sessions WHERE session_id=? AND user_id=?').bind(payload.sid,payload.sub).run()}
      catch{return json({ok:false,message:'تعذر تسجيل الخروج. أعد المحاولة.'},503)}
    }
  }
  const response=json({ok:true});
  response.headers.append('Set-Cookie',expireCookie(SESSION_COOKIE));
  response.headers.append('Set-Cookie',expireCookie(STATE_COOKIE));
  response.headers.append('Set-Cookie',expireCookie('raja_contact_challenge'));
  return response;
}
