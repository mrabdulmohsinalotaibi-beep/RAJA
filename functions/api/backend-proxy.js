// RAJA Pages proxy to a user-owned backend. Server config is private and never exposed to browsers.
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const idRegex=/^[A-Za-z0-9_-]{11}$/;
export function validatedSocialUrl(raw) {
  try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
    const h=u.hostname.toLowerCase().replace(/^(www\.|m\.)/,'');
    if(h==='instagram.com'&&/^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))
      return 'https://www.instagram.com'+u.pathname.replace(/\/?$/,'/');
    if(h==='tiktok.com'&&/^\/@[A-Za-z0-9_.-]+\/video\/[0-9]+\/?$/.test(u.pathname))
      return 'https://www.tiktok.com'+u.pathname;
    if(['vm.tiktok.com','vt.tiktok.com'].includes(h)&&/^\/(t|v)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))
      return 'https://'+h+u.pathname;
    return null;
  }catch{return null}
}
export function serverOrigin(env) {
  const raw=env?.MEDIA_BACKEND_URL;
  if(!raw || typeof raw!=='string')return null;
  try{
    const u=new URL(raw.trim());
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/')return null;
    const h=u.hostname.toLowerCase();
    if(h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||h.match(/^\d+\.\d+\.\d+\.\d+$/)||h.startsWith('['))return null;
    return u.origin;
  }catch{return null;}
}
const send=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:JSON_HEADERS});
export async function proxiedFormats(request,env,id,socialUrl=null) {
  const origin=serverOrigin(env);
  if(!origin)return null;
  if(!socialUrl&&!idRegex.test(id))return send({ok:false,error:'invalid_video_id'},400);
  const url=new URL('/api/formats',origin);
  url.searchParams.set('url',socialUrl||'https://www.youtube.com/watch?v='+id);
  let upstream;
  try{
    upstream=await fetch(url.toString(),{method:'GET',headers:{'Accept':'application/json'},redirect:'follow'});
  }catch{
    return send({ok:false,error:'backend_unavailable',message:'خادم معالجة الوسائط غير متاح الآن؛ ربما يستيقظ من وضع الخمول.'},503);
  }
  const result=await upstream.json().catch(()=>null);
  if(!upstream.ok||!result?.ok){
    return send({ok:false,error:result?.detail||'backend_format_failed',message:result?.detail||'تعذّر استخراج صيغ الملف. قد يقيّد YouTube تنزيل هذا المقطع.'},upstream.ok?422:upstream.status);
  }
  const streams=(Array.isArray(result.choices)?result.choices:[])
    .filter(s=>['mp4','mp3'].includes(s.format)&&['video','audio'].includes(s.kind)&&Number.isInteger(Number(s.quality)))
    .map((s,i)=>({index:i,format:s.format,kind:s.kind,quality:String(s.quality),backend:true,bitrate:null,size:null}));
  if(!streams.length)return send({ok:false,error:'no_formats_available'},404);
  return send({ok:true,title:result.title,duration:result.duration,streams,provider:'raja-private-backend',platform:result.platform||'youtube'});
}
export async function proxiedDownload(request,env,{id,format,kind,quality,socialUrl=null}) {
  const origin=serverOrigin(env);
  if(!origin)return null;
  if(!socialUrl&&!idRegex.test(id))return send({ok:false,error:'invalid_video_id'},400);
  if(!(['mp4','mp3'].includes(format)&&
       (format==='mp4'?kind==='video':kind==='audio')&&
       Number.isInteger(Number(quality))&&Number(quality)>=144&&Number(quality)<=1080)) {
    return send({ok:false,error:'unsupported_format'},400);
  }
  const url=new URL('/api/download',origin);
  url.searchParams.set('url',socialUrl||'https://www.youtube.com/watch?v='+id);
  url.searchParams.set('format',format);
  url.searchParams.set('quality',String(quality));
  let upstream;
  try{
    upstream=await fetch(url.toString(),{method:'GET',redirect:'follow'});
  }catch{
    return send({ok:false,error:'backend_unavailable',message:'لم يتصل رَجْع بخادم التنزيل. جرّب لاحقًا.'},503);
  }
  if(!upstream.ok) {
    const problem=await upstream.json().catch(()=>null);
    const detail=problem?.detail;
    return send({ok:false,error:'backend_download_failed',message:typeof detail==='string'?detail:'تعذّر تنزيل المقطع من YouTube على الخادم المجاني.'},upstream.status);
  }
  const h=new Headers({
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Content-Type':upstream.headers.get('content-type')||(format==='mp3'?'audio/mpeg':'video/mp4'),
    'Content-Disposition':upstream.headers.get('content-disposition')||'attachment; filename="raja-'+id+'.'+format+'"'
  });
  const len=upstream.headers.get('content-length');
  if(len && /^\d+$/.test(len))h.set('Content-Length',len);
  return new Response(upstream.body,{status:200,headers:h});
}
