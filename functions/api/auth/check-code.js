import {json,seal,unseal,getCookie,cookie,expireCookie,SESSION_COOKIE} from '../../_lib/google-auth.js';
import {contactRequest,limit,verifyProvider,digest} from '../../_lib/contact-auth.js';
export async function onRequestPost({request,env}){
 const parsed=await contactRequest(request,env);if(parsed.response)return parsed.response;
 const {channel,identity,body}=parsed;
 if(typeof body.code!=='string'||!/^\d{4,10}$/.test(body.code))return json({ok:false,message:'أدخل رمز تحقق صحيحًا.'},400);
 const now=Math.floor(Date.now()/1000);
 const target=await digest(channel+':'+identity);
 const challenge=await unseal(getCookie(request,'raja_contact_challenge'),env.RAJA_SESSION_SECRET);
 if(!challenge||challenge.iss!=='raja-contact-challenge'||challenge.target!==target||!Number.isInteger(challenge.exp)||challenge.exp<=now||challenge.iat>now)return json({ok:false,message:'اطلب رمزًا جديدًا من هذا الجهاز أولًا.'},400);
 try{
  if(!await limit(env,request,identity,'check'))return json({ok:false,message:'محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.'},429);
  const result=await verifyProvider(env,'VerificationCheck',{To:identity,Code:body.code});
  if(!result.ok||result.data.status!=='approved')return json({ok:false,message:'رمز التحقق غير صحيح أو انتهت صلاحيته.'},400);
  const user={id:'contact-'+target,email:channel==='email'?identity:'',phone:channel==='sms'?identity:'',name:''};
  const token=await seal({iss:'raja-contact',sub:user.id,email:user.email,phone:user.phone,name:'',iat:now,exp:now+7*86400},env.RAJA_SESSION_SECRET);
  const response=json({ok:true,user});response.headers.append('Set-Cookie',cookie(SESSION_COOKIE,token,7*86400));
  response.headers.append('Set-Cookie',expireCookie('raja_contact_challenge'));return response;
 }catch{return json({ok:false,message:'تعذر التحقق من الرمز. حاول لاحقًا.'},503)}
}
