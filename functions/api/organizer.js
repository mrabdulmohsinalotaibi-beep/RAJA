import {configured,currentUser,json} from '../_lib/google-auth.js';

const empty=()=>({favorites:[],playlists:[],clips:[]});
const validId=id=>typeof id==='string' && /^[A-Za-z0-9_-]{11}$/.test(id);
const text=(s,max)=>typeof s==='string'&&s.trim().length<=max?s.trim():null;
const unique=items=>new Set(items).size===items.length;
function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const {favorites,playlists,clips}=body;
 if(!Array.isArray(favorites)||favorites.length>200||!Array.isArray(playlists)||playlists.length>50||!Array.isArray(clips)||clips.length>200)return null;
 if(!unique(favorites.map(f=>f.videoId)))return null;
 const validatedFavorites=[];
 for(const f of favorites){
  if(!f||!validId(f.videoId))return null;
  const title=text(f.title||'',120);
  if(title===null)return null;
  validatedFavorites.push({videoId:f.videoId,title});
 }
 const validatedPlaylists=[];
 const ids=[];
 for(const p of playlists){
  if(!p||typeof p.id!=='string'||!(/^[a-zA-Z0-9_-]{8,70}$/.test(p.id)))return null;
  const name=text(p.name,80);
  if(!name||!Array.isArray(p.items)||p.items.length>150||p.items.some(id=>!validId(id))||!unique(p.items))return null;
  ids.push(p.id);validatedPlaylists.push({id:p.id,name,items:p.items});
 }
 if(!unique(ids))return null;
 const validatedClips=[];
 const clipIds=[];
 for(const c of clips){
  if(!c||typeof c.id!=='string'||!(/^[a-zA-Z0-9_-]{8,70}$/.test(c.id))||!validId(c.videoId))return null;
  const name=text(c.title,100);
  if(name===null||!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<0||c.end<=c.start||c.end>43200||c.end-c.start>7200)return null;
  const remindAt=c.remindAt==null?null:typeof c.remindAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/.test(c.remindAt)&&Number.isFinite(Date.parse(c.remindAt))?c.remindAt:null;
  if(c.remindAt!=null&&!remindAt)return null;
  clipIds.push(c.id);validatedClips.push({id:c.id,videoId:c.videoId,title:name||'',start:c.start,end:c.end,remindAt});
 }
 if(!unique(clipIds))return null;
 return {favorites:validatedFavorites,playlists:validatedPlaylists,clips:validatedClips};
}
async function load(db,subject){
 const row=await db.prepare('SELECT data, version, updated_at FROM raja_organizer WHERE subject = ?').bind(subject).first();
 if(!row)return {data:empty(),version:0,updatedAt:null};
 let data;try{data=JSON.parse(row.data)}catch{data=empty()}
 return {data,version:row.version,updatedAt:new Date(row.updated_at*1000).toISOString()};
}
async function userFor(request,env){
 if(!configured(env))return {response:json({ok:false,error:'google_oauth_not_configured'},503)};
 const user=await currentUser(request,env);
 if(!user)return {response:json({ok:false,error:'google_signin_required'},401)};
 if(!env.RAJA_DB)return {response:json({ok:false,error:'storage_unavailable'},503)};
 return {user};
}
export async function onRequestGet({request,env}){
 const {user,response}=await userFor(request,env);
 if(response)return response;
 try{return json({ok:true,...await load(env.RAJA_DB,user.id)})}
 catch{return json({ok:false,error:'database_read_failed'},503)}
}
export async function onRequestPut({request,env}){
 const {user,response}=await userFor(request,env);
 if(response)return response;
 if(request.headers.get('Origin')!=='https://raja.athat.app')return json({ok:false,error:'invalid_origin'},403);
 if(!String(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return json({ok:false,error:'invalid_content_type'},415);
 const contentLength=Number(request.headers.get('Content-Length')||0);
 if(contentLength>110000)return json({ok:false,error:'too_large'},413);
 let input;
 try{const raw=await request.text();if(raw.length>110000)return json({ok:false,error:'too_large'},413);input=JSON.parse(raw)}
 catch{return json({ok:false,error:'invalid_json'},400)}
 const version=input?.version, data=validate(input?.data);
 if(!Number.isInteger(version)||version<0||!data)return json({ok:false,error:'invalid_organizer_data'},400);
 const encoded=JSON.stringify(data);
 const now=Math.floor(Date.now()/1000);
 try {
  let result;
  if(version===0){
    result=await env.RAJA_DB.prepare('INSERT OR IGNORE INTO raja_organizer (subject, data, version, updated_at) VALUES (?, ?, 1, ?)').bind(user.id,encoded,now).run();
  }else{
    result=await env.RAJA_DB.prepare('UPDATE raja_organizer SET data = ?, version = version + 1, updated_at = ? WHERE subject = ? AND version = ?').bind(encoded,now,user.id,version).run();
  }
  if((result.meta?.changes||0)!==1)return json({ok:false,error:'conflict',latest:await load(env.RAJA_DB,user.id)},409);
  return json({ok:true,data,version:version+1,updatedAt:new Date(now*1000).toISOString()});
 }catch{return json({ok:false,error:'database_write_failed'},503)}
}
