import {json} from '../../_lib/google-auth.js';
import {passwordRequest,verifyPassword,accountSession} from '../../_lib/password-auth.js';
export async function onRequestPost({request,env}){
 const input=await passwordRequest(request,env,'login');if(input.response)return input.response;
 try{
  const row=await env.RAJA_DB.prepare('SELECT * FROM raja_accounts WHERE email = ?').bind(input.email).first();
  const valid=await verifyPassword(input.body.password,row,env);
  if(!row||!valid)return json({ok:false,message:'البريد الإلكتروني أو كلمة المرور غير صحيحة.'},401);
  const control=await env.RAJA_DB.prepare('SELECT suspended FROM raja_user_controls WHERE user_id=?').bind(row.id).first();if(control?.suspended)return json({ok:false,message:'هذا الحساب معلّق. تواصل مع إدارة الموقع.'},403);
  return await accountSession(row,env);
 }catch{return json({ok:false,message:'تعذر تسجيل الدخول الآن. حاول لاحقًا.'},503)}
}
