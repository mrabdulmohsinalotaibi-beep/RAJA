import {json,randomToken,expireCookie} from '../../_lib/google-auth.js';
import {hashPassword,verifyPassword,hashRecovery,verifyRecovery,validPassword} from '../../_lib/password-auth.js';
import {normalizeContact} from '../../_lib/contact-auth.js';
import {siteSettings} from '../../_lib/site-settings.js';
import {ADMIN_COOKIE,activationHash,adminRequest,adminLimit,currentAdmin,adminSession,audit,now} from '../../_lib/admin-auth.js';
import {serverOrigin} from '../backend-proxy.js';
const bad=(message,status=400)=>json({ok:false,message},status);
const publicAdmin=a=>({id:a.id,name:a.name,phone:a.phone,role:a.role});
async function credentials(path,request,env,body){
 const phone=normalizeContact('sms',body.phone);if(!phone||typeof body.password!=='string'||body.password.length<1||body.password.length>128)return bad('أدخل رقم الجوال وكلمة المرور بشكل صحيح.');
 if(!await adminLimit(env,request,phone,path))return bad('محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.',429);
 const row=await env.RAJA_DB.prepare('SELECT * FROM raja_admin_accounts WHERE phone=?').bind(phone).first();
 if(path==='login'){
  const valid=await verifyPassword(body.password,row?.password_hash?row:null,env);
  if(!row||!valid||row.disabled)return bad('رقم الجوال أو كلمة المرور غير صحيحة.',401);
  return adminSession(row,env);
 }
 if(!validPassword(body.password))return bad('استخدم كلمة مرور من 12 إلى 128 حرفًا.');
 let expected;
 if(path==='activate'){
  if(typeof body.code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.code))return bad('رابط التفعيل غير صالح أو منتهي.',401);
  expected=await activationHash(body.code);
  if(!row||row.disabled||row.activation_hash!==expected||row.activation_expires<=now())return bad('رابط التفعيل غير صالح أو منتهي.',401);
 }else{
  if(typeof body.recoveryCode!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(body.recoveryCode))return bad('بيانات الاستعادة غير صحيحة.',401);
  const valid=await verifyRecovery(body.recoveryCode,row?.recovery_hash,env);if(!row||row.disabled||!valid)return bad('بيانات الاستعادة غير صحيحة.',401);
 }
 const password=await hashPassword(body.password,env),recoveryCode=randomToken(24),t=now();
 const field=path==='activate'?'activation_hash':'recovery_hash',hash=path==='activate'?expected:row.recovery_hash;
 const updated=await env.RAJA_DB.prepare('UPDATE raja_admin_accounts SET password_salt=?,password_hash=?,password_iterations=?,recovery_hash=?,activation_hash=NULL,activation_expires=NULL,credential_version=credential_version+1,updated_at=? WHERE id=? AND credential_version=? AND '+field+'=? AND disabled=0'+(path==='activate'?' AND activation_expires>?':'')).bind(password.salt,password.hash,password.iterations,await hashRecovery(recoveryCode,env),t,row.id,row.credential_version,hash,...(path==='activate'?[t]:[])).run();
 if(updated.meta.changes!==1)return bad('تغيّرت بيانات الحساب. استخدم رابطًا أو رمزًا جديدًا.',409);
 await audit(env,row.id,path,row.id).run();row.credential_version++;return adminSession(row,env,{recoveryCode});
}
export async function onRequest({request,env}){
 try{
  const path=new URL(request.url).pathname.split('/').filter(Boolean).at(-1),method=request.method;
  if(!['GET','POST'].includes(method))return bad('طريقة الطلب غير مدعومة.',405);
  let body;
  if(method==='POST'){const p=await adminRequest(request,env);if(p.response)return p.response;body=p.body}
  if(['login','activate','recover'].includes(path)&&method==='POST')return await credentials(path,request,env,body);
  const admin=await currentAdmin(request,env);
  if(path==='session'&&method==='GET')return json({ok:true,authenticated:!!admin,admin:admin?publicAdmin(admin):null});
  if(!admin)return bad('سجّل دخول الإدارة أولًا.',401);
  if(path==='logout'&&method==='POST'){await env.RAJA_DB.prepare('DELETE FROM raja_admin_sessions WHERE session_id=? AND admin_id=?').bind(admin.sid,admin.id).run();const r=json({ok:true});r.headers.append('Set-Cookie',expireCookie(ADMIN_COOKIE));return r}
  if(method==='POST'&&!await adminLimit(env,request,admin.id,'mutate'))return bad('طلبات كثيرة. انتظر قليلًا وأعد المحاولة.',429);
  if(path==='overview'&&method==='GET'){
   const counts=await env.RAJA_DB.prepare('SELECT (SELECT COUNT(*) FROM raja_accounts) users,(SELECT COUNT(*) FROM raja_user_controls WHERE suspended=1) suspended,(SELECT COUNT(*) FROM raja_password_sessions WHERE expires_at>?) sessions,(SELECT COUNT(*) FROM raja_admin_accounts WHERE disabled=0) admins').bind(now()).first();
   const recent=await env.RAJA_DB.prepare('SELECT x.id,x.action,x.target,x.created_at,a.name actor FROM raja_admin_audit x LEFT JOIN raja_admin_accounts a ON a.id=x.actor_id ORDER BY x.created_at DESC,x.id DESC LIMIT 12').all();
   return json({ok:true,counts,recent:recent.results,settings:await siteSettings(env),release:'v27',storage:'device-only'});
  }
  if(path==='users'&&method==='GET'){
   const u=new URL(request.url),q=(u.searchParams.get('q')||'').trim().slice(0,100),page=Math.max(1,Math.min(100000,Number(u.searchParams.get('page'))||1)),pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
   const where=" WHERE (a.name LIKE ? ESCAPE '\\' OR a.email LIKE ? ESCAPE '\\')";
   const total=await env.RAJA_DB.prepare('SELECT COUNT(*) total FROM raja_accounts a'+where).bind(pattern,pattern).first();
   const rows=await env.RAJA_DB.prepare('SELECT a.id,a.name,a.email,a.created_at,COALESCE(c.suspended,0) suspended,(SELECT COUNT(*) FROM raja_password_sessions s WHERE s.user_id=a.id AND s.expires_at>?) sessions FROM raja_accounts a LEFT JOIN raja_user_controls c ON c.user_id=a.id'+where+' ORDER BY a.created_at DESC,a.id LIMIT 30 OFFSET ?').bind(now(),pattern,pattern,(Math.floor(page)-1)*30).all();return json({ok:true,users:rows.results,total:total.total,page:Math.floor(page)});
  }
  if(path==='users'&&method==='POST'){
   if(!['suspend','restore','revoke'].includes(body.action)||typeof body.id!=='string')return bad('إجراء المستخدم غير صالح.');
   const row=await env.RAJA_DB.prepare('SELECT id FROM raja_accounts WHERE id=?').bind(body.id).first();if(!row)return bad('الحساب غير موجود.',404);
   const statements=[];if(body.action!=='revoke')statements.push(env.RAJA_DB.prepare('INSERT INTO raja_user_controls(user_id,suspended,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET suspended=excluded.suspended,updated_at=excluded.updated_at').bind(row.id,body.action==='suspend'?1:0,now()));
   if(body.action!=='restore')statements.push(env.RAJA_DB.prepare('DELETE FROM raja_password_sessions WHERE user_id=?').bind(row.id));statements.push(audit(env,admin.id,'user-'+body.action,row.id));await env.RAJA_DB.batch(statements);return json({ok:true});
  }
  if(path==='settings'&&method==='POST'){
   if(typeof body.title!=='string'||!body.title.trim()||body.title.length>60||typeof body.announcement!=='string'||body.announcement.length>300||typeof body.registrationOpen!=='boolean'||typeof body.downloadsEnabled!=='boolean'||!Number.isInteger(body.version))return bad('تحقق من إعدادات الموقع.');
   const result=await env.RAJA_DB.prepare('UPDATE raja_site_settings SET title=?,announcement=?,registration_open=?,downloads_enabled=?,version=version+1,updated_at=? WHERE id=1 AND version=?').bind(body.title.trim(),body.announcement.trim(),Number(body.registrationOpen),Number(body.downloadsEnabled),now(),body.version).run();if(result.meta.changes!==1)return bad('تم تعديل الإعدادات من جلسة أخرى. حدّث الصفحة ثم أعد المحاولة.',409);await audit(env,admin.id,'settings-update','site').run();return json({ok:true,settings:await siteSettings(env)});
  }
  if(path==='audit'&&method==='GET'){const rows=await env.RAJA_DB.prepare('SELECT x.id,x.action,x.target,x.created_at,a.name actor FROM raja_admin_audit x LEFT JOIN raja_admin_accounts a ON a.id=x.actor_id ORDER BY x.created_at DESC,x.id DESC LIMIT 100').all();return json({ok:true,events:rows.results})}
  if(path==='services'&&method==='POST'){
   const checks=[{name:'قاعدة البيانات',ok:!!await env.RAJA_DB.prepare('SELECT 1 ok').first()}],origin=serverOrigin(env);
   if(origin){try{const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(8000),redirect:'error',headers:{Accept:'application/json'}}),d=await r.json();checks.push({name:'خادم تجهيز الوسائط',ok:r.ok&&d.ok===true})}catch{checks.push({name:'خادم تجهيز الوسائط',ok:false})}}else checks.push({name:'خادم تجهيز الوسائط',ok:false});
   await audit(env,admin.id,'services-check','site').run();return json({ok:true,checks,checkedAt:now(),note:'نجاح فحص الخادم لا يضمن استخراج جميع روابط يوتيوب.'});
  }
  if(path==='password'&&method==='POST'){
   if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||!validPassword(body.password))return bad('تحقق من كلمة المرور الحالية والجديدة.');const row=await env.RAJA_DB.prepare('SELECT * FROM raja_admin_accounts WHERE id=?').bind(admin.id).first();if(!await verifyPassword(body.currentPassword,row,env))return bad('كلمة المرور الحالية غير صحيحة.',401);
   const p=await hashPassword(body.password,env),result=await env.RAJA_DB.prepare('UPDATE raja_admin_accounts SET password_salt=?,password_hash=?,password_iterations=?,credential_version=credential_version+1,updated_at=? WHERE id=? AND credential_version=? AND disabled=0').bind(p.salt,p.hash,p.iterations,now(),row.id,row.credential_version).run();if(result.meta.changes!==1)return bad('تغيّرت بيانات الحساب. سجّل الدخول مجددًا.',409);await audit(env,admin.id,'password-change',row.id).run();row.credential_version++;return adminSession(row,env);
  }
  if(path==='admins'){
   if(admin.role!=='owner')return bad('هذه الخدمة لمالك الموقع فقط.',403);
   if(method==='GET'){const rows=await env.RAJA_DB.prepare('SELECT id,phone,name,role,disabled,created_at,last_login,(password_hash IS NOT NULL) activated FROM raja_admin_accounts ORDER BY created_at,id').all();return json({ok:true,admins:rows.results})}
   if(body.action==='create'){
    const phone=normalizeContact('sms',body.phone),name=typeof body.name==='string'?body.name.trim():'';if(!phone||!name||name.length>80)return bad('أدخل الاسم ورقم جوال سعودي صحيحًا.');
    const id='admin-'+crypto.randomUUID(),code=randomToken(32);const result=await env.RAJA_DB.prepare("INSERT OR IGNORE INTO raja_admin_accounts(id,phone,name,role,activation_hash,activation_expires,created_at,updated_at) VALUES(?,?,?,'admin',?,?,?,?)").bind(id,phone,name,await activationHash(code),now()+86400,now(),now()).run();if(result.meta.changes!==1)return bad('يوجد حساب إدارة بهذا الرقم.',409);await audit(env,admin.id,'admin-create',id).run();return json({ok:true,activationCode:code});
   }
   if(!['disable','enable','reinvite'].includes(body.action)||typeof body.id!=='string')return bad('إجراء الإدارة غير صالح.');
   const row=await env.RAJA_DB.prepare('SELECT id,role FROM raja_admin_accounts WHERE id=?').bind(body.id).first();if(!row)return bad('حساب الإدارة غير موجود.',404);if(row.role==='owner'||row.id===admin.id)return bad('لا يمكن تعطيل أو إعادة دعوة حساب المالك من هنا.',403);
   let code;const statements=[];
   if(body.action==='reinvite'){code=randomToken(32);statements.push(env.RAJA_DB.prepare('UPDATE raja_admin_accounts SET activation_hash=?,activation_expires=?,password_hash=NULL,password_salt=NULL,recovery_hash=NULL,credential_version=credential_version+1,updated_at=? WHERE id=? AND role=\'admin\'').bind(await activationHash(code),now()+86400,now(),row.id))}
   else statements.push(env.RAJA_DB.prepare('UPDATE raja_admin_accounts SET disabled=?,credential_version=credential_version+1,updated_at=? WHERE id=? AND role=\'admin\'').bind(body.action==='disable'?1:0,now(),row.id));
   statements.push(env.RAJA_DB.prepare('DELETE FROM raja_admin_sessions WHERE admin_id=?').bind(row.id),audit(env,admin.id,'admin-'+body.action,row.id));await env.RAJA_DB.batch(statements);return json({ok:true,...(code?{activationCode:code}:{})});
  }
  return bad('الخدمة غير موجودة.',404);
 }catch{return bad('تعذر إكمال الطلب الآن. حاول مجددًا.',503)}
}
