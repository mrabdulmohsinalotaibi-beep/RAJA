import {json} from '../_lib/google-auth.js';
import {guard,bodyJSON,bounded,validId,problem,CHUNK,MAX_FILE,ACCOUNT_LIMIT,APP_LIMIT} from '../_lib/cloud-sync.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const keyFor=(subject,id)=>'accounts/'+encodeURIComponent(subject)+'/'+id+'/'+crypto.randomUUID();
const lookup=(db,user,id)=>db.prepare('SELECT * FROM raja_cloud_files WHERE subject=? AND id=?').bind(user,id).first();
const mimeFor=name=>({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',flac:'audio/flac',mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm'})[name.trim().split('.').pop().toLowerCase()];
async function expire(env,subject){
 const rows=await env.RAJA_DB.prepare("SELECT * FROM raja_cloud_files WHERE subject=? AND status='uploading' AND expires_at<? LIMIT 5").bind(subject,Math.floor(Date.now()/1000)).all();
 for(const row of rows.results){if(row.upload_id)await env.RAJA_MEDIA.resumeMultipartUpload(row.object_key,row.upload_id).abort();await env.RAJA_DB.prepare("DELETE FROM raja_cloud_files WHERE subject=? AND id=? AND status='uploading' AND expires_at<?").bind(subject,row.id,Math.floor(Date.now()/1000)).run()}
}
export async function onRequestPost({request,env}){
 try{
  const {user,response}=await guard(request,env,true);if(response)return response;
  const body=await bodyJSON(request,4096),id=body.id;
  if(!validId(id))throw fail('معرف الملف غير صالح.');
  let row=await lookup(env.RAJA_DB,user.id,id);
  if(body.action==='complete'){
   if(!row||row.status==='deleted')throw fail('الملف غير موجود.',404);
   if(row.status==='ready')return json({ok:true,ready:true});
   if(!row.upload_id)throw fail('لم يبدأ رفع الملف بعد.',409);
   const parts=(await env.RAJA_DB.prepare('SELECT part AS partNumber,etag,size FROM raja_upload_parts WHERE subject=? AND file_id=? ORDER BY part').bind(user.id,id).all()).results;
   if(parts.length!==Math.ceil(row.size/CHUNK)||parts.reduce((n,p)=>n+p.size,0)!==row.size)throw fail('رفع الملف لم يكتمل بعد.',409);
   const upload=env.RAJA_MEDIA.resumeMultipartUpload(row.object_key,row.upload_id);
   let object;
   try{object=await upload.complete(parts.map(({partNumber,etag})=>({partNumber,etag})))}catch(error){object=await env.RAJA_MEDIA.head(row.object_key);if(!object)throw error}
   if(object.size!==row.size){await env.RAJA_MEDIA.delete(row.object_key);throw fail('حجم الملف المرفوع غير مطابق.',422)}
   const changed=await env.RAJA_DB.prepare("UPDATE raja_cloud_files SET status='ready',upload_id=NULL,expires_at=0 WHERE subject=? AND id=? AND status='uploading'").bind(user.id,id).run();
   if(changed.meta.changes!==1){const latest=await lookup(env.RAJA_DB,user.id,id);if(latest?.status==='ready'&&latest.object_key===row.object_key)return json({ok:true,ready:true});await env.RAJA_MEDIA.delete(row.object_key);throw fail('أُلغي رفع هذا الملف.',409)}
   await env.RAJA_DB.prepare('DELETE FROM raja_upload_parts WHERE subject=? AND file_id=?').bind(user.id,id).run();
   return json({ok:true,ready:true});
  }
  if(body.action!=='init')throw fail('عملية غير صالحة.');
  if(row?.status==='deleted')throw fail('حُذف الملف من الحساب.',410);
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>200||!Number.isInteger(body.size)||body.size<=0||body.size>MAX_FILE)throw fail('حجم الملف أو اسمه غير مدعوم. الحد 400 ميجابايت.');
  const mime=mimeFor(body.name);if(!mime)throw fail('صيغة الملف غير مدعومة.');
  await expire(env,user.id);row=await lookup(env.RAJA_DB,user.id,id);
  if(!row){
   const key=keyFor(user.id,id),now=Math.floor(Date.now()/1000);
   const result=await env.RAJA_DB.prepare("INSERT OR IGNORE INTO raja_cloud_files(subject,id,name,mime,size,at,object_key,status,expires_at) SELECT ?,?,?,?,?,?,?,'uploading',? WHERE (SELECT COALESCE(SUM(size),0) FROM raja_cloud_files WHERE subject=? AND status!='deleted')+?<=? AND (SELECT COALESCE(SUM(size),0) FROM raja_cloud_files WHERE status!='deleted')+?<=? AND (SELECT COUNT(*) FROM raja_cloud_files WHERE subject=?)<2000").bind(user.id,id,body.name,mime,body.size,Number.isFinite(body.at)?body.at:Date.now(),key,now+86400,user.id,body.size,ACCOUNT_LIMIT,body.size,APP_LIMIT,user.id).run();
   row=await lookup(env.RAJA_DB,user.id,id);
   if(!row)throw fail('لا تكفي سعة المزامنة المتاحة. سعة الحساب 1 جيجابايت.',507);
   if(result.meta.changes===1){
    let upload;try{upload=await env.RAJA_MEDIA.createMultipartUpload(key,{httpMetadata:{contentType:mime}})}catch(error){await env.RAJA_DB.prepare("DELETE FROM raja_cloud_files WHERE subject=? AND id=? AND object_key=? AND upload_id IS NULL AND status='uploading'").bind(user.id,id,key).run();throw error}
    const changed=await env.RAJA_DB.prepare("UPDATE raja_cloud_files SET upload_id=? WHERE subject=? AND id=? AND status='uploading' AND object_key=?").bind(upload.uploadId,user.id,id,key).run();
    if(changed.meta.changes!==1){await upload.abort();throw fail('أُلغي رفع الملف.',409)}
    row.upload_id=upload.uploadId;
   }
  }
  if(row.size!==body.size||row.name!==body.name)throw fail('يتعارض الملف مع نسخة سابقة.',409);
  if(row.status==='ready')return json({ok:true,ready:true});
  if(!row.upload_id)throw fail('يجري بدء الرفع؛ أعد المحاولة بعد قليل.',409);
  const parts=(await env.RAJA_DB.prepare('SELECT part FROM raja_upload_parts WHERE subject=? AND file_id=? ORDER BY part').bind(user.id,id).all()).results.map(p=>p.part);
  return json({ok:true,ready:false,chunkSize:CHUNK,parts});
 }catch(e){return problem(e)}
}
export async function onRequestPut({request,env}){
 try{
  const {user,response}=await guard(request,env,true);if(response)return response;
  const url=new URL(request.url),id=url.searchParams.get('id'),part=Number(url.searchParams.get('part'));
  if(!validId(id)||!Number.isInteger(part)||part<1)throw fail('جزء الملف غير صالح.');
  const row=await lookup(env.RAJA_DB,user.id,id);
  if(!row||row.status!=='uploading'||!row.upload_id)throw fail('لا يوجد رفع نشط لهذا الملف.',409);
  const total=Math.ceil(row.size/CHUNK);if(part>total)throw fail('جزء الملف غير صالح.');
  const expected=part===total?row.size-(part-1)*CHUNK:CHUNK,bytes=await bounded(request,expected);
  if(bytes.length!==expected)throw fail('جزء الملف لم يصل كاملًا.',422);
  const upload=env.RAJA_MEDIA.resumeMultipartUpload(row.object_key,row.upload_id),result=await upload.uploadPart(part,bytes);
  await env.RAJA_DB.prepare("INSERT INTO raja_upload_parts(subject,file_id,part,etag,size) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM raja_cloud_files WHERE subject=? AND id=? AND status='uploading') ON CONFLICT(subject,file_id,part) DO UPDATE SET etag=excluded.etag,size=excluded.size").bind(user.id,id,part,result.etag,bytes.length,user.id,id).run();
  await env.RAJA_DB.prepare("UPDATE raja_cloud_files SET expires_at=? WHERE subject=? AND id=? AND status='uploading'").bind(Math.floor(Date.now()/1000)+86400,user.id,id).run();
  return json({ok:true,part});
 }catch(e){return problem(e)}
}
export async function onRequestGet({request,env}){
 try{
  const {user,response}=await guard(request,env);if(response)return response;
  const id=new URL(request.url).searchParams.get('id');if(!validId(id))throw fail('معرف غير صالح.');
  const row=await lookup(env.RAJA_DB,user.id,id);if(!row||row.status!=='ready')throw fail('الملف غير موجود.',404);
  let range;const raw=request.headers.get('Range');
  if(raw){const m=/^bytes=(\d*)-(\d*)$/.exec(raw);if(!m||(!m[1]&&!m[2]))throw fail('نطاق غير صالح.',416);let start=m[1]?Number(m[1]):Math.max(0,row.size-Number(m[2])),end=m[1]?(m[2]?Math.min(Number(m[2]),row.size-1):row.size-1):row.size-1;if(start<0||start>=row.size||end<start)throw fail('نطاق غير صالح.',416);range={offset:start,length:end-start+1}}
  const object=await env.RAJA_MEDIA.get(row.object_key,range?{range}:undefined);if(!object)throw fail('تعذر العثور على الملف المخزن.',404);
  const h=new Headers({'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Accept-Ranges':'bytes','Content-Length':String(range?.length||row.size),'Content-Disposition':(new URL(request.url).searchParams.has('download')?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(row.name)});
  if(range)h.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${row.size}`);
  return new Response(object.body,{status:range?206:200,headers:h});
 }catch(e){return problem(e)}
}
export async function onRequestDelete({request,env}){
 try{
  const {user,response}=await guard(request,env,true);if(response)return response;
  const id=new URL(request.url).searchParams.get('id');if(!validId(id))throw fail('معرف غير صالح.');
  const row=await lookup(env.RAJA_DB,user.id,id);
  await env.RAJA_DB.prepare("INSERT INTO raja_cloud_files(subject,id,name,mime,size,at,object_key,status,expires_at) VALUES (?,?,'','audio/mpeg',0,?,'','deleted',0) ON CONFLICT(subject,id) DO UPDATE SET status='deleted'").bind(user.id,id,Date.now()).run();
  if(row?.upload_id){try{await env.RAJA_MEDIA.resumeMultipartUpload(row.object_key,row.upload_id).abort()}catch{}}
  if(row?.object_key)await env.RAJA_MEDIA.delete(row.object_key);
  await env.RAJA_DB.prepare('DELETE FROM raja_upload_parts WHERE subject=? AND file_id=?').bind(user.id,id).run();
  return json({ok:true});
 }catch(e){return problem(e)}
}
