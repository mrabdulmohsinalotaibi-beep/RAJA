const TYPES={mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',aac:'audio/aac',ogg:'audio/ogg',flac:'audio/flac',opus:'audio/ogg',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',mkv:'video/x-matroska',pdf:'application/pdf',zip:'application/zip',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const MAX_BYTES=100*1024*1024;
const error=(message,status)=>new Response(JSON.stringify({ok:false,error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function safeURL(raw){
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')return null;
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.onion')||host.endsWith('.workers.dev')||host.endsWith('.pages.dev')||host.endsWith('.cloudflare.com')||host==='raja.athat.app'||host==='athat.app')return null;
  if(/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.includes(':')||!host.includes('.'))return null;
  if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be'||host.endsWith('.googlevideo.com'))return null;
  const ext=url.pathname.split('.').pop().toLowerCase();
  if(!TYPES[ext])return null;
  return {url,ext};
 }catch{return null}
}
export async function onRequestGet({request}){
 const source=safeURL(new URL(request.url).searchParams.get('url')||'');
 if(!source)return error('unsupported_or_unsafe_url',400);
 let upstream;
 try{upstream=await fetch(source.url.href,{redirect:'manual',headers:{Accept:'*/*'},signal:AbortSignal.timeout(12000)})}
 catch{return error('source_unavailable',502)}
 if(upstream.status>=300&&upstream.status<400)return error('source_redirect_not_supported',422);
 if(!upstream.ok||!upstream.body)return error('source_error_'+upstream.status,502);
 const length=Number(upstream.headers.get('content-length')||0);
 if(length>MAX_BYTES){upstream.body.cancel().catch(()=>{});return error('file_too_large',413)}
 const mime=(upstream.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(mime==='text/html'||mime==='application/json'||mime==='text/plain'){upstream.body.cancel().catch(()=>{});return error('source_not_a_file',422)}
 // Stream up to the limit without buffering the file in Worker memory.
 let seen=0;const reader=upstream.body.getReader();
 const limited=new ReadableStream({
  async pull(controller){try{const {done,value}=await reader.read();if(done){controller.close();return}seen+=value.byteLength;if(seen>MAX_BYTES){controller.error(new Error('file_too_large'));reader.cancel().catch(()=>{});return}controller.enqueue(value)}catch(e){controller.error(e)}},
  cancel(reason){return reader.cancel(reason)}
 });
 const basename=source.url.pathname.split('/').pop()||('raja.'+source.ext);
 const safe=basename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,90)||('raja.'+source.ext);
 return new Response(limited,{headers:{'Content-Type':TYPES[source.ext], 'Content-Disposition':'attachment; filename="'+safe+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
