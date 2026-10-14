import {currentUser,json} from './google-auth.js';
export const CHUNK=8*1024*1024,MAX_FILE=400*1024*1024,ACCOUNT_LIMIT=1024*1024*1024,APP_LIMIT=5*1024*1024*1024;
export const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(id);
export const empty=()=>({lessons:[],links:[]});
export async function guard(request,env,mutate=false){
 const user=await currentUser(request,env);
 if(!user)return {response:json({ok:false,message:'سجل الدخول إلى حسابك لمزامنة بياناتك.'},401)};
 if(!env.RAJA_DB||!env.RAJA_MEDIA)return {response:json({ok:false,message:'تخزين المزامنة غير متاح الآن.'},503)};
 if(mutate&&request.headers.get('Origin')!=='https://raja.athat.app')return {response:json({ok:false,message:'مصدر الطلب غير مسموح.'},403)};
 if(mutate){
  const now=Math.floor(Date.now()/1000),key='sync:'+user.id+':'+Math.floor(now/60);
  const row=await env.RAJA_DB.prepare('INSERT INTO raja_auth_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,now+120).first();
  if(row.attempts>180)return {response:json({ok:false,message:'طلبات كثيرة؛ ستستأنف المزامنة بعد قليل.'},429)};
 }
 return {user};
}
export async function bounded(request,max){
 if(Number(request.headers.get('Content-Length'))>max)throw Object.assign(Error('الطلب أكبر من الحد المسموح.'),{status:413});
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Object.assign(Error('الطلب أكبر من الحد المسموح.'),{status:413})}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}
export async function bodyJSON(request,max=1100000){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Object.assign(Error('نوع الطلب غير صالح.'),{status:415});
 try{return JSON.parse(new TextDecoder().decode(await bounded(request,max)))}catch(e){if(e.status)throw e;throw Object.assign(Error('بيانات غير صالحة.'),{status:400})}
}
export const problem=error=>json({ok:false,message:error.status?error.message:'تعذرت المزامنة. ستعاد المحاولة دون فقد النسخة المحلية.'},error.status||503);
const title=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const unique=items=>new Set(items.map(x=>x.id)).size===items.length;
const position=p=>p&&((p.id===null)||validId(p.id))&&Number.isFinite(p.offset)&&p.offset>=0&&p.offset<=43200;
export function validate(data){
 if(!data||!Array.isArray(data.lessons)||data.lessons.length>100||!Array.isArray(data.links)||data.links.length>1000||!unique(data.lessons)||!unique(data.links))return null;
 const lessons=[];
 for(const l of data.lessons){
  if(!validId(l.id)||!title(l.name,150)||!Number.isInteger(l.minutes)||l.minutes<1||l.minutes>720||!/^([01]\d|2[0-3]):[0-5]\d$/.test(l.start)||!Array.isArray(l.items)||l.items.length>500||!unique(l.items))return null;
  const items=[];
  for(const i of l.items){
   if(!validId(i.id)||!title(i.title,200)||!['file','url','youtube'].includes(i.type))return null;
   const item={id:i.id,title:i.title,type:i.type};
   if(i.type==='file'){if(!validId(i.libraryId))return null;item.libraryId=i.libraryId;if(typeof i.mime==='string'&&/^(audio|video)\/[a-zA-Z0-9.+-]{1,80}$/.test(i.mime))item.mime=i.mime}
   if(i.type==='url'){try{const u=new URL(i.url);if(u.protocol!=='https:'||i.url.length>2000) return null;item.url=u.href}catch{return null}}
   if(i.type==='youtube'){if(!/^[\w-]{11}$/.test(i.videoId))return null;item.videoId=i.videoId;if(validId(i.libraryId))item.libraryId=i.libraryId}
   items.push(item);
  }
  let day=null,cursor=null;
  if(l.cursor!=null){if(!position(l.cursor))return null;cursor={id:l.cursor.id,offset:l.cursor.offset}}
  if(l.day!=null){const d=l.day;if(!/^\d{4}-\d{2}-\d{2}$/.test(d.key)||!position(d.start)||!position(d.next)||!Number.isInteger(d.minutes)||d.minutes<1||d.minutes>720||!Number.isFinite(d.furthest)||d.furthest<0||d.furthest>d.minutes*60+1)return null;day={key:d.key,start:{id:d.start.id,offset:d.start.offset},next:{id:d.next.id,offset:d.next.offset},minutes:d.minutes,furthest:d.furthest}}
  lessons.push({id:l.id,name:l.name,minutes:l.minutes,start:l.start,items,cursor,day});
 }
 const links=[];
 for(const i of data.links){if(!validId(i.id)||!title(i.name,200)||!/^[\w-]{11}$/.test(i.videoId)||!Number.isFinite(i.at))return null;links.push({id:i.id,type:'youtube',name:i.name,videoId:i.videoId,at:i.at})}
 return {lessons,links};
}
export async function snapshot(db,subject){
 const row=await db.prepare('SELECT data,version FROM raja_sync WHERE subject=?').bind(subject).first();
 return row?{data:JSON.parse(row.data),version:row.version}:{data:empty(),version:0};
}
