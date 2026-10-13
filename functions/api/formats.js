import {proxiedFormats} from './backend-proxy.js';
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

// Optional first-party extraction attempt through an undocumented YouTube client.
// These formats can become unavailable whenever YouTube changes its playback API.
const YT_API_KEY='AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const YT_CLIENTS=[
 {name:'ANDROID_VR',version:'1.65.10',number:'28',ua:'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',deviceMake:'Oculus',deviceModel:'Quest 3',androidSdkVersion:32,osName:'Android',osVersion:'12L'},
 {name:'WEB_EMBEDDED_PLAYER',version:'2.20260708.00.00',number:'56',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15,gzip(gfe)'}
];
async function probeYouTube(id,client){
  const context={client:{clientName:client.name,clientVersion:client.version,hl:'en',gl:'US'}};
  for(const k of ['deviceMake','deviceModel','androidSdkVersion','osName','osVersion'])if(client[k])context.client[k]=client[k];
  if(client.name==='WEB_EMBEDDED_PLAYER')context.thirdParty={embedUrl:'https://www.youtube.com/embed/'+id};
  const body={context,videoId:id,contentCheckOk:true,racyCheckOk:true};
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),6500);
  let res;
  try{
    res=await fetch('https://www.youtube.com/youtubei/v1/player?key='+YT_API_KEY,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':client.ua,
        'X-YouTube-Client-Name':client.number,'X-YouTube-Client-Version':client.version},
      body:JSON.stringify(body),signal:ctrl.signal
    });
    if(!res.ok)throw new Error('innertube_http_'+res.status);
    const json=await res.json();
    if(json.playabilityStatus?.status!=='OK')throw new Error('youtube_'+String(json.playabilityStatus?.status||'blocked'));
    const streams=[];
    for(const entry of json.streamingData?.formats||[]){
      const e=sanitize({url:entry.url,mimeType:entry.mimeType,quality:entry.qualityLabel||entry.quality,bitrate:entry.bitrate,size:entry.contentLength},'video');
      if(e)streams.push(e);
    }
    for(const entry of json.streamingData?.adaptiveFormats||[]){
      if(!String(entry.mimeType||'').startsWith('audio/'))continue;
      const e=sanitize({url:entry.url,mimeType:entry.mimeType,quality:entry.audioQuality||entry.quality,bitrate:entry.bitrate,size:entry.contentLength},'audio');
      if(e)streams.push(e);
    }
    if(!streams.length)throw new Error('youtube_formats_unavailable');
    return {ok:true,provider:'youtube-'+client.name.toLowerCase(),instance:'youtube.com',title:String(json.videoDetails?.title||'مقطع YouTube').slice(0,160),duration:Number(json.videoDetails?.lengthSeconds)||null,streams};
  }finally{clearTimeout(timer)}
}
const sources=[...PIPED.map(s=>['piped',s]),...INVIDIOUS.map(s=>['invidious',s])];
export async function resolveVideo(id) {
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('invalid_video_id');
  const errors=[];
  // Attempt two lightweight client configurations before third-party mirrors.
  const native=await Promise.all(YT_CLIENTS.map(async client=>{
    try{return await probeYouTube(id,client);}
    catch(e){errors.push({source:'youtube-'+client.name,reason:String(e.message||'blocked').slice(0,45)});return null;}
  }));
  const first=native.find(Boolean);
  if(first)return {data:first,errors};
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
export async function onRequestGet({request,env}){
  const u=new URL(request.url);
  const id=u.searchParams.get('id')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))return new Response(JSON.stringify({ok:false,error:'invalid_video_id'}),{status:400,headers});
  const privateResult=await proxiedFormats(request,env,id);
  if(privateResult)return privateResult;
  const {data,errors}=await resolveVideo(id);
  if(!data)return new Response(JSON.stringify({ok:false,error:'No available free extraction providers',attempts:errors}),{status:503,headers});
  return new Response(JSON.stringify({ok:true,title:data.title,provider:data.provider,instance:data.instance,duration:data.duration,streams:data.streams.map((s,i)=>({index:i,format:s.format,kind:s.kind,quality:s.quality,bitrate:s.bitrate,size:s.size})),providerFailures:errors.length}),{headers});
}