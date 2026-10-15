import {adminLimit,adminSession} from '../../_lib/admin-auth.js';
import {json} from '../../_lib/google-auth.js';
import {passwordRequest,verifyPassword,accountSession} from '../../_lib/password-auth.js';
export async function onRequestPost({request,env}){
 const input=await passwordRequest(request,env,'login');if(input.response)return input.response;
 try{
  if(input.phone){
   // An administrative identity only accepts its administrative credentials.
   // Both login routes share the same admin throttle and server-side session checks.
   if(!await adminLimit(env,request,input.phone,'login'))return json({ok:false,message:'محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.'},429);
   const admin=await env.RAJA_DB.prepare('SELECT * FROM raja_admin_accounts WHERE phone=?').bind(input.phone).first();
   if(admin){
    const valid=await verifyPassword(input.body.password,admin.password_hash?admin:null,env);
    if(!valid||admin.disabled)return json({ok:false,message:'رقم الجوال أو البريد الإلكتروني أو كلمة المرور غير صحيحة.'},401);
    return await adminSession(admin,env,{redirect:'/admin/'});
   }
  }
  const row=await env.RAJA_DB.prepare('SELECT * FROM raja_accounts WHERE email = ?').bind(input.identity).first();
  const valid=await verifyPassword(input.body.password,row,env);
  if(!row||!valid)return json({ok:false,message:'رقم الجوال أو البريد الإلكتروني أو كلمة المرور غير صحيحة.'},401);
  const control=await env.RAJA_DB.prepare('SELECT suspended FROM raja_user_controls WHERE user_id=?').bind(row.id).first();if(control?.suspended)return json({ok:false,message:'هذا الحساب معلّق. تواصل مع إدارة الموقع.'},403);
  return await accountSession(row,env);
 }catch{return json({ok:false,message:'تعذر تسجيل الدخول الآن. حاول لاحقًا.'},503)}
}
