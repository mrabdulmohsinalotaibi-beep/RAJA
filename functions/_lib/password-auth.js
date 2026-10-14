import {json,seal,base64url,unbase64url,randomToken,cookie,SESSION_COOKIE} from './google-auth.js';
import {passwordConfigured} from './auth-config.js';
const encoder=new TextEncoder();
export const ITERATIONS=100000;
export const emailAddress=value=>typeof value==='string'&&value.trim().length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())?value.trim().toLowerCase():null;
export const validPassword=value=>typeof value==='string'&&value.length>=12&&value.length<=128;
async function pepperKey(env,label){
 return crypto.subtle.importKey('raw',encoder.encode(env.RAJA_SESSION_SECRET+'|'+label),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function derive(password,salt,iterations){
 if(!Number.isInteger(iterations)||iterations<10000||iterations>100000)throw Error('invalid-kdf');
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations,salt:unbase64url(salt)},key,256);
}
export async function hashPassword(password,env){
 const salt=randomToken(24),bits=await derive(password,salt,ITERATIONS);
 const hash=await crypto.subtle.sign('HMAC',await pepperKey(env,'password-v1'),bits);
 return {salt,hash:base64url(new Uint8Array(hash)),iterations:ITERATIONS};
}
export async function verifyPassword(password,row,env){
 // A missing account still executes the KDF; native HMAC verification avoids string comparisons.
 const salt=row?.password_salt||'cmFqYS1kdW1teS1zYWx0LW5vdC1hLXNlY3JldA';
 const bits=await derive(password,salt,row?.password_iterations||ITERATIONS);
 return crypto.subtle.verify('HMAC',await pepperKey(env,'password-v1'),row?unbase64url(row.password_hash):new Uint8Array(32),bits);
}
export async function hashRecovery(code,env){
 return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',await pepperKey(env,'recovery-v1'),encoder.encode(code))));
}
export async function verifyRecovery(code,hash,env){
 return crypto.subtle.verify('HMAC',await pepperKey(env,'recovery-v1'),unbase64url(hash||base64url(new Uint8Array(32))),encoder.encode(code));
}
async function rateLimit(env,request,email,action){
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)throw Error('missing-client-ip');
 const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/600);
 for(const [scope,value,max] of [['ip',ip,action==='login'?30:5],['email',email,action==='login'?10:3]]){
  const digest=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const key='password:'+action+':'+scope+':'+digest+':'+bucket;
  const row=await env.RAJA_DB.prepare('INSERT INTO raja_auth_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ? RETURNING attempts').bind(key,now+1200,max).first();
  if(!row)return false;
 }
 await env.RAJA_DB.prepare('DELETE FROM raja_auth_limits WHERE key IN (SELECT key FROM raja_auth_limits WHERE expires_at < ? LIMIT 100)').bind(now).run();
 return true;
}
export async function passwordRequest(request,env,action){
 if(request.headers.get('Origin')!=='https://raja.athat.app')return {response:json({ok:false,message:'مصدر الطلب غير صالح.'},403)};
 if(!passwordConfigured(env))return {response:json({ok:false,message:'خدمة الحسابات غير متاحة الآن.'},503)};
 if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return {response:json({ok:false,message:'صيغة الطلب غير صالحة.'},415)};
 let body;
 try{
  if(Number(request.headers.get('Content-Length')||0)>4096)return {response:json({ok:false,message:'حجم الطلب كبير.'},413)};
  const reader=request.body?.getReader();if(!reader)throw Error();let total=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>4096){await reader.cancel();return {response:json({ok:false,message:'حجم الطلب كبير.'},413)}}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}body=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return {response:json({ok:false,message:'بيانات الطلب غير صالحة.'},400)}}
 const email=emailAddress(body?.email);
 if(!email||typeof body.password!=='string'||body.password.length<1||body.password.length>128)return {response:json({ok:false,message:'أدخل بريدك وكلمة المرور بشكل صحيح.'},400)};
 if(action!=='login'&&!validPassword(body.password))return {response:json({ok:false,message:'استخدم كلمة مرور من 12 إلى 128 حرفًا.'},400)};
 try{if(!await rateLimit(env,request,email,action))return {response:json({ok:false,message:'محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.'},429)}}
 catch{return {response:json({ok:false,message:'خدمة الحسابات غير متاحة الآن.'},503)}}
 return {body,email};
}
export async function accountSession(row,env,extra={}){
 const now=Math.floor(Date.now()/1000),sid=randomToken(32),expires=now+7*86400;
 await env.RAJA_DB.prepare('DELETE FROM raja_password_sessions WHERE session_id IN (SELECT session_id FROM raja_password_sessions WHERE expires_at<=? LIMIT 100)').bind(now).run();
 const result=await env.RAJA_DB.prepare('INSERT INTO raja_password_sessions (session_id, user_id, credential_version, expires_at) SELECT ?, id, credential_version, ? FROM raja_accounts WHERE id = ? AND credential_version = ?').bind(sid,expires,row.id,row.credential_version).run();
 if((result.meta?.changes||0)!==1)throw Error('credentials-changed');
 const payload={iss:'raja-password',sub:row.id,email:row.email,name:row.name,sid,iat:now,exp:expires};
 const token=await seal(payload,env.RAJA_SESSION_SECRET);
 const response=json({ok:true,user:{id:row.id,email:row.email,name:row.name,emailVerified:false},...extra});
 response.headers.append('Set-Cookie',cookie(SESSION_COOKIE,token,7*86400));return response;
}
