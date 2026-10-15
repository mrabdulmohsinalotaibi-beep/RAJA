import {siteSettings} from './_lib/site-settings.js';
import {configured,currentUser,json} from './_lib/google-auth.js';
export async function onRequest({request,env,next}) {
  const path=new URL(request.url).pathname;
  if(path==='/api/formats'||path==='/api/download'){try{if(!(await siteSettings(env)).downloads_enabled)return json({ok:false,message:'التنزيلات متوقفة مؤقتًا من إدارة الموقع.'},503)}catch{return json({ok:false,message:'خدمة التنزيل غير متاحة الآن.'},503)}}
  if (configured(env) && (path==='/api/formats' || path==='/api/download')) {
    const user=await currentUser(request,env);
    if(!user)return json({ok:false,error:'google_signin_required',message:'يرجى تسجيل الدخول بحساب Google الخاص بك قبل استخدام التنزيل.'},401);
  }
  return next();
}
