import {proxiedDownload} from './backend-proxy.js';
import {resolveVideo} from './formats.js';

const allowed=new Set(['mp4','webm','m4a','mp3','ogg','opus']);
const mimeByFormat={mp4:'video/mp4',webm:'video/webm',m4a:'audio/mp4',mp3:'audio/mpeg',ogg:'audio/ogg',opus:'audio/ogg'};
function jsonError(error,status){
  return new Response(JSON.stringify({ok:false,error}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function filename(title,format){
  const clean=String(title||'RAJA').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/\s+/g,' ').trim().slice(0,100)||'RAJA';
  return {ascii:'raja-video.'+format,utf:"UTF-8''"+encodeURIComponent(clean+'.'+format)};
}
export async function onRequestGet({request,env}){
  const u=new URL(request.url);
  const id=u.searchParams.get('id')||'';
  const format=(u.searchParams.get('format')||'').toLowerCase();
  const quality=(u.searchParams.get('quality')||'').slice(0,60);
  const kind=u.searchParams.get('kind')||'';
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))return jsonError('invalid_video_id',400);
  if(!allowed.has(format)||!['video','audio'].includes(kind))return jsonError('invalid_format',400);
  const privateResult=await proxiedDownload(request,env,{id,format,kind,quality});
  if(privateResult)return privateResult;
  const {data}=await resolveVideo(id);
  if(!data)return jsonError('sources_unavailable',503);
  const candidates=data.streams.filter(s=>s.format===format&&s.kind===kind);
  if(!candidates.length)return jsonError('format_unavailable',404);
  const selected=candidates.find(s=>s.quality===quality)||candidates[0];
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  let upstream;
  try{
    upstream=await fetch(selected.url,{method:'GET',headers:{'User-Agent':'RAJA/1.0','Accept':'*/*'},signal:controller.signal,redirect:'follow'});
  }catch{return jsonError('upstream_unavailable',502)}
  finally{clearTimeout(timeout)}
  if(!upstream.ok||!upstream.body)return jsonError('upstream_error_'+upstream.status,502);
  const contentType=upstream.headers.get('content-type')||'';
  if(/text\/html|application\/json|text\/plain|application\/xml/i.test(contentType)){
    upstream.body.cancel().catch(()=>{});
    return jsonError('upstream_not_media',502);
  }
  const names=filename(data.title,format);
  const headers=new Headers({
    'Content-Type':contentType.includes('/')?contentType:mimeByFormat[format],
    'Content-Disposition':'attachment; filename="'+names.ascii+'"; filename*='+names.utf,
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Cross-Origin-Resource-Policy':'same-origin'
  });
  const length=upstream.headers.get('content-length');
  if(length&&/^\d+$/.test(length))headers.set('Content-Length',length);
  return new Response(upstream.body,{status:200,headers});
}