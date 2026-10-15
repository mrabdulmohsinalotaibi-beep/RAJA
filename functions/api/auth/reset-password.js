import {json,randomToken} from '../../_lib/google-auth.js';
import {passwordRequest,verifyRecovery,hashPassword,hashRecovery,accountSession} from '../../_lib/password-auth.js';
export async function onRequestPost({request,env}){
 const input=await passwordRequest(request,env,'reset');if(input.response)return input.response;
 const code=input.body.recoveryCode;
 if(typeof code!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(code))return json({ok:false,message:'أدخل رمز الاستعادة الذي حفظته عند إنشاء حسابك.'},400);
 try{
  const row=await env.RAJA_DB.prepare('SELECT * FROM raja_accounts WHERE email = ?').bind(input.identity).first();
  const valid=await verifyRecovery(code,row?.recovery_hash,env);
  if(!row||!valid)return json({ok:false,message:'بيانات الاستعادة غير صحيحة.'},401);
  const password=await hashPassword(input.body.password,env),recoveryCode=randomToken(24);
  const result=await env.RAJA_DB.prepare('UPDATE raja_accounts SET password_salt=?, password_hash=?, password_iterations=?, recovery_hash=?, credential_version=credential_version+1, updated_at=? WHERE id=? AND credential_version=? AND recovery_hash=?').bind(password.salt,password.hash,password.iterations,await hashRecovery(recoveryCode,env),Math.floor(Date.now()/1000),row.id,row.credential_version,row.recovery_hash).run();
  if((result.meta?.changes||0)!==1)return json({ok:false,message:'تغيرت بيانات الاستعادة. أعد المحاولة.'},409);
  // Sessions carrying an older credential_version are invalid immediately, including concurrent sessions.
  row.credential_version++;return await accountSession(row,env,{recoveryCode});
 }catch{return json({ok:false,message:'تعذرت استعادة الحساب الآن. حاول لاحقًا.'},503)}
}
