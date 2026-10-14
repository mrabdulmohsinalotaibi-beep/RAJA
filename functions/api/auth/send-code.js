import {json,seal,cookie} from '../../_lib/google-auth.js';
import {contactRequest,limit,verifyProvider,digest} from '../../_lib/contact-auth.js';
export async function onRequestPost({request,env}){
 const parsed=await contactRequest(request,env);if(parsed.response)return parsed.response;
 const {channel,identity}=parsed;
 try{
  if(!await limit(env,request,identity,'send'))return json({ok:false,message:'محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.'},429);
  const result=await verifyProvider(env,'Verifications',{To:identity,Channel:channel});
  if(!result.ok||result.data.status!=='pending')return json({ok:false,message:'تعذر إرسال رمز التحقق. تحقق من بياناتك أو حاول لاحقًا.'},result.status===429?429:503);
  const now=Math.floor(Date.now()/1000);
  const token=await seal({iss:'raja-contact-challenge',target:await digest(channel+':'+identity),iat:now,exp:now+600},env.RAJA_SESSION_SECRET);
  const response=json({ok:true,message:'أُرسل رمز التحقق. أدخله لإكمال الدخول.'});
  response.headers.append('Set-Cookie',cookie('raja_contact_challenge',token,600));return response;
 }catch{return json({ok:false,message:'خدمة التحقق غير متاحة الآن. حاول لاحقًا.'},503)}
}
