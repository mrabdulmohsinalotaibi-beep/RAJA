import {SESSION_COOKIE,STATE_COOKIE,expireCookie,json,userOriginAllowed} from '../../_lib/google-auth.js';
export async function onRequestPost({request}) {
  if(!userOriginAllowed(request))return json({ok:false,error:'invalid_origin'},403);
  const response=json({ok:true});
  response.headers.append('Set-Cookie',expireCookie(SESSION_COOKIE));
  response.headers.append('Set-Cookie',expireCookie(STATE_COOKIE));
  response.headers.append('Set-Cookie',expireCookie('raja_contact_challenge'));
  return response;
}
