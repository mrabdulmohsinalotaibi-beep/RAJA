import {json} from './google-auth.js';
import {contactConfigured,contactMethods} from './auth-config.js';
export {contactConfigured,contactMethods};
export function normalizeContact(channel,value){
 if(typeof value!=='string')return null;
 if(channel==='email'){
  const email=value.trim().toLowerCase();
  return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
 }
 if(channel==='sms'){
  let phone=value.trim().replace(/[\s()-]/g,'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
  if(/^05\d{8}$/.test(phone))phone='+966'+phone.slice(1);
  else if(/^5\d{8}$/.test(phone))phone='+966'+phone;
  else if(/^00966/.test(phone))phone='+'+phone.slice(2);
  // Saudi mobile numbers only, matching this application's intended audience.
  return /^\+9665\d{8}$/.test(phone)?phone:null;
 }
 return null;
}
export async function digest(value){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function contactRequest(request,env){
 if(request.headers.get('Origin')!=='https://raja.athat.app')return {response:json({ok:false,message:'مصدر الطلب غير صالح.'},403)};
 if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return {response:json({ok:false,message:'صيغة الطلب غير صالحة.'},415)};
 if(!contactConfigured(env))return {response:json({ok:false,message:'الدخول بالبريد والجوال غير مفعّل بعد. يلزم ربط مزود التحقق.'},503)};
 let body;
 try{if(Number(request.headers.get('Content-Length')||0)>1500)throw Error();const raw=await request.text();if(raw.length>1500)throw Error();body=JSON.parse(raw)}catch{return {response:json({ok:false,message:'بيانات الطلب غير صالحة.'},400)}}
 const channel=body?.channel,identity=normalizeContact(channel,body?.identity);
 if(!identity)return {response:json({ok:false,message:'أدخل بريدًا صحيحًا أو رقم جوال سعوديًا يبدأ بـ 05.'},400)};
 if(!contactMethods(env)[channel])return {response:json({ok:false,message:'طريقة الدخول المختارة غير مفعّلة حاليًا.'},503)};
 return {channel,identity,body};
}
export async function limit(env,request,identity,kind){
 const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/600),ip=request.headers.get('CF-Connecting-IP');
 if(!ip)throw Error('missing-client-ip');
 // One atomic counter per destination and per source IP; hashing avoids contact/IP plaintext in counters.
 for(const [scope,value,max] of [['destination',identity,kind==='send'?3:8],['ip',ip,kind==='send'?10:30]]){
  const key=kind+':'+scope+':'+await digest(value)+':'+bucket;
  const result=await env.RAJA_DB.prepare('INSERT INTO raja_auth_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ? RETURNING attempts').bind(key,now+1200,max).first();
  if(!result)return false;
 }
 // Indexed bounded cleanup; failures remain fail-closed to avoid sending without rate limits.
 await env.RAJA_DB.prepare('DELETE FROM raja_auth_limits WHERE key IN (SELECT key FROM raja_auth_limits WHERE expires_at < ? LIMIT 100)').bind(now).run();
 return true;
}
export async function verifyProvider(env,action,values){
 const response=await fetch('https://verify.twilio.com/v2/Services/'+env.TWILIO_VERIFY_SERVICE_SID+'/'+action,{
  method:'POST',headers:{Authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(values),signal:AbortSignal.timeout(15000)
 });
 const data=await response.json().catch(()=>({}));
 return {ok:response.ok,status:response.status,data};
}
