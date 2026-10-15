import {json,seal,unseal,getCookie,cookie,randomToken} from './google-auth.js';
import {rateLimit} from './password-auth.js';
export const ADMIN_COOKIE='raja_admin_session';
export const now=()=>Math.floor(Date.now()/1000);
export async function activationHash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export function audit(env,actor,action,target=''){return env.RAJA_DB.prepare('INSERT INTO raja_admin_audit(id,actor_id,action,target,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,now())}
export async function adminRequest(request,env,maxBytes=4096){
 if(request.headers.get('Origin')!=='https://raja.athat.app')return {response:json({ok:false,message:'مصدر الطلب غير صالح.'},403)};
 if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return {response:json({ok:false,message:'صيغة الطلب غير صالحة.'},415)};
 if(!env?.RAJA_DB||String(env?.RAJA_SESSION_SECRET||'').length<32)return {response:json({ok:false,message:'الإدارة غير متاحة الآن.'},503)};
 try{const reader=request.body?.getReader();if(!reader)throw Error();let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();return {response:json({ok:false,message:'حجم الطلب كبير.'},413)}}chunks.push(value)}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return {body}}catch{return {response:json({ok:false,message:'بيانات الطلب غير صالحة.'},400)}}
}
export async function adminLimit(env,request,identity,action){return rateLimit(env,request,identity,'admin-'+action,{ip:action==='mutate'?180:30,identity:action==='mutate'?120:10})}
export async function currentAdmin(request,env){
 if(!env?.RAJA_DB||!env?.RAJA_SESSION_SECRET)return null;
 const p=await unseal(getCookie(request,ADMIN_COOKIE),env.RAJA_SESSION_SECRET),t=now();
 if(!p||p.iss!=='raja-admin'||!p.sub||!p.sid||!Number.isInteger(p.iat)||!Number.isInteger(p.exp)||p.iat>t+30||p.exp<=t||p.exp>t+8*3600)return null;
 const row=await env.RAJA_DB.prepare('SELECT a.id,a.phone,a.name,a.role FROM raja_admin_sessions s JOIN raja_admin_accounts a ON a.id=s.admin_id WHERE s.session_id=? AND a.id=? AND s.expires_at>? AND s.credential_version=a.credential_version AND a.disabled=0 AND a.password_hash IS NOT NULL').bind(p.sid,p.sub,t).first();
 return row?{...row,sid:p.sid}:null;
}
export async function adminSession(row,env,extra={}){
 const t=now(),sid=randomToken(32),exp=t+8*3600;
 const result=await env.RAJA_DB.prepare('INSERT INTO raja_admin_sessions(session_id,admin_id,credential_version,expires_at,created_at) SELECT ?,id,credential_version,?,? FROM raja_admin_accounts WHERE id=? AND credential_version=? AND disabled=0 AND password_hash IS NOT NULL').bind(sid,exp,t,row.id,row.credential_version).run();if(result.meta.changes!==1)throw Error('credentials-changed');
 await env.RAJA_DB.batch([env.RAJA_DB.prepare('UPDATE raja_admin_accounts SET last_login=? WHERE id=?').bind(t,row.id),audit(env,row.id,'login',row.id),env.RAJA_DB.prepare('DELETE FROM raja_admin_sessions WHERE session_id IN (SELECT session_id FROM raja_admin_sessions WHERE expires_at<=? LIMIT 100)').bind(t)]);
 const token=await seal({iss:'raja-admin',sub:row.id,sid,iat:t,exp},env.RAJA_SESSION_SECRET);const r=json({ok:true,admin:{id:row.id,name:row.name,phone:row.phone,role:row.role},...extra});r.headers.append('Set-Cookie',cookie(ADMIN_COOKIE,token,8*3600));return r;
}
