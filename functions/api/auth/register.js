import {json,randomToken} from '../../_lib/google-auth.js';
import {passwordRequest,hashPassword,hashRecovery,accountSession} from '../../_lib/password-auth.js';
export async function onRequestPost({request,env}){
 const input=await passwordRequest(request,env,'register');if(input.response)return input.response;
 const name=typeof input.body.name==='string'?input.body.name.trim():'';
 if(!name||name.length>100)return json({ok:false,message:'أدخل اسمك، بحد أقصى 100 حرف.'},400);
 try{
  const existing=await env.RAJA_DB.prepare('SELECT id FROM raja_accounts WHERE email = ?').bind(input.email).first();
  if(existing)return json({ok:false,message:'تعذر إنشاء الحساب بهذا البريد. إذا كان لك حساب، استخدم تسجيل الدخول أو الاستعادة.'},409);
  const password=await hashPassword(input.body.password,env),recoveryCode=randomToken(24),now=Math.floor(Date.now()/1000);
  const row={id:'account-'+crypto.randomUUID(),email:input.email,name,credential_version:1};
  const inserted=await env.RAJA_DB.prepare('INSERT OR IGNORE INTO raja_accounts (id,email,name,password_salt,password_hash,password_iterations,recovery_hash,credential_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)').bind(row.id,row.email,row.name,password.salt,password.hash,password.iterations,await hashRecovery(recoveryCode,env),now,now).run();
  if((inserted.meta?.changes||0)!==1)return json({ok:false,message:'تعذر إنشاء الحساب بهذا البريد. استخدم تسجيل الدخول أو الاستعادة.'},409);
  return await accountSession(row,env,{recoveryCode});
 }catch{return json({ok:false,message:'تعذر إنشاء الحساب الآن. حاول لاحقًا.'},503)}
}
