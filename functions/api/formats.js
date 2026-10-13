// Extracts public format metadata from alternative video frontends.
// Depends on independent volunteer-run instances: no guarantee of service or availability.
const PIPED=[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.nosebs.ru',
  'https://pipedapi.owo.si',
  'https://api.piped.private.coffee'
];
const INVIDIOUS=[
  'https://inv.nadeko.net',
  'https://invidious.tiekoetter.com',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com'
];
const FORMATS=new Set(['mp4','webm','m4a','mp3','ogg','opus']);
function cleanFormat(raw){
  const s=String(raw||'').toLowerCase();
  if(s.includes('m4a')||s.includes('audio/mp4'))return'm4a';
  if(s.includes('mp4'))return'mp4';
  if(s.includes('webm'))return'webm';
  if(s.includes('opus'))return'opus';
  if(s.includes('ogg'))return'ogg';
  if(s.includes('mp3'))return'mp3';
  return'';
}
function isSafeMediaUrl(raw){
  try{
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password)return false;
    const h=u.hostname.toLowerCase();
    return !['localhost','0.0.0.0'].includes(h)&&!/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h)&&!h.endsWith('.internal')&&!h.endsWith('.local');
  }catch{return false;}
}
function sanitize(stream,kind){
  if(!stream||!isSafeMediaUrl(stream.url))return null;
  const format=cleanFormat(stream.format||stream.mimeType||stream.type||stream.container||stream.codec);
  if(!FORMATS.has(format))return null;
  return {
    kind,
    format,
    quality:String(stream.quality||stream.qualityLabel||stream.resolution||stream.bitrate||'').slice(0,60),
    bitrate:Number(stream.bitrate)||null,
    size:Number(stream.size||stream.contentLength)||null,
    url:stream.url
  };
}
async function getJSON(url,timeout=5000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const res=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json'},redirect:'follow'});
    if(!res.ok)throw new Error('http_'+res.status);
    const len=Number(res.headers.get('content-length')||0);
    if(len>2_000_000)throw new Error('oversized_response');
    return await res.json();
  }finally{clearTimeout(timer);}
}
async function probe(type,base,id){
  const data=await getJSON(base+(type==='piped'?'/streams/':'/api/v1/videos/')+encodeURIComponent(id));
  if(data.error)throw new Error('provider_error');
  const list=[];
  const add=(entry,kind)=>{const e=sanitize(entry,kind);if(e&&list.length<45)list.push(e);};
  if(type==='piped'){
    for(const e of data.videoStreams||[]){
      // Video streams can be video-only; only paired audio+video works as a standalone MP4 file.
      const mime=String(e.mimeType||'');
      const videoOnly=e.videoOnly===true||e.audioTrack===false;
      if(!videoOnly && !/mpegurl|dash\+xml|m3u8/i.test(mime))add(e,'video');
    }
    for(const e of data.audioStreams||[])add(e,'audio');
  }else{
    for(const e of data.formatStreams||[])add(e,'video');
    for(const e of data.adaptiveFormats||[]){
      const mime=String(e.type||e.mimeType||'');
      if(mime.includes('audio/'))add(e,'audio');
    }
  }
  if(!list.length)throw new Error('no_streams');
  return {ok:true,provider:type,instance:base,title:String(data.title||'مقطع YouTube').slice(0,160),duration:Number(data.duration||data.lengthSeconds)||null,streams:list};
}
const sources=[...PIPED.map(s=>['piped',s]),...INVIDIOUS.map(s=>['invidious',s])];
export async function resolveVideo(id) {
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('invalid_video_id');
  const errors=[];
  // Small batches avoid flooding volunteer-hosted public services.
  for(let start=0;start<sources.length;start+=3){
    const batch=sources.slice(start,start+3);
    const settled=await Promise.all(batch.map(async ([type,base])=>{
      try{return await probe(type,base,id);}
      catch(e){errors.push({source:base,reason:String(e.message||'unavailable').slice(0,40)});return null;}
    }));
    const good=settled.filter(Boolean);
    if(good.length){
      good.sort((a,b)=>b.streams.filter(s=>s.kind==='video'&&s.format==='mp4').length-a.streams.filter(s=>s.kind==='video'&&s.format==='mp4').length);
      return {data:good[0],errors};
    }
  }
  return {data:null,errors};
}
export async function onRequestGet({request}){
  const u=new URL(request.url);
  const id=u.searchParams.get('id')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))return new Response(JSON.stringify({ok:false,error:'invalid_video_id'}),{status:400,headers});
  const {data,errors}=await resolveVideo(id);
  if(!data)return new Response(JSON.stringify({ok:false,error:'No available free extraction providers',attempts:errors}),{status:503,headers});
  return new Response(JSON.stringify({ok:true,title:data.title,provider:data.provider,instance:data.instance,duration:data.duration,streams:data.streams.map((s,i)=>({index:i,format:s.format,kind:s.kind,quality:s.quality,bitrate:s.bitrate,size:s.size})),providerFailures:errors.length}),{headers});
}