import {configured,currentUser,json} from './_lib/google-auth.js';
export async function onRequest({request,env,next}) {
  const path=new URL(request.url).pathname;
  if (configured(env) && (path==='/api/formats' || path==='/api/download')) {
    const user=await currentUser(request,env);
    if(!user)return json({ok:false,error:'google_signin_required',message:'يرجى تسجيل الدخول بحساب Google الخاص بك قبل استخدام التنزيل.'},401);
  }
  return next();
}
