import {json} from '../_lib/google-auth.js';
import {guard,bodyJSON,validate,snapshot,problem,CHUNK,ACCOUNT_LIMIT,MAX_FILE} from '../_lib/cloud-sync.js';
export async function onRequestGet({request,env}){
 try{
  const {user,response}=await guard(request,env);if(response)return response;
  await env.RAJA_DB.prepare('DELETE FROM raja_auth_limits WHERE key IN (SELECT key FROM raja_auth_limits WHERE expires_at<? LIMIT 100)').bind(Math.floor(Date.now()/1000)).run();
  const files=await env.RAJA_DB.prepare("SELECT id,name,mime,size,at,status FROM raja_cloud_files WHERE subject=? AND status IN ('ready','deleted')").bind(user.id).all();
  const usage=await env.RAJA_DB.prepare("SELECT COALESCE(SUM(size),0) used FROM raja_cloud_files WHERE subject=? AND status!='deleted'").bind(user.id).first();
  return json({ok:true,...await snapshot(env.RAJA_DB,user.id),files:files.results,used:usage.used,limit:ACCOUNT_LIMIT,maxFile:MAX_FILE,chunkSize:CHUNK});
 }catch(e){return problem(e)}
}
export async function onRequestPut({request,env}){
 try{
  const {user,response}=await guard(request,env,true);if(response)return response;
  const body=await bodyJSON(request),data=validate(body.data),version=body.version;
  if(!data||!Number.isInteger(version)||version<0)return json({ok:false,message:'بيانات المزامنة غير صالحة.'},400);
  const now=Math.floor(Date.now()/1000),encoded=JSON.stringify(data);
  const statement=version===0?env.RAJA_DB.prepare('INSERT OR IGNORE INTO raja_sync(subject,data,version,updated_at) VALUES (?,?,1,?)').bind(user.id,encoded,now):env.RAJA_DB.prepare('UPDATE raja_sync SET data=?,version=version+1,updated_at=? WHERE subject=? AND version=?').bind(encoded,now,user.id,version);
  const result=await statement.run();
  if(result.meta.changes!==1)return json({ok:false,conflict:true,...await snapshot(env.RAJA_DB,user.id)},409);
  return json({ok:true,data,version:version+1});
 }catch(e){return problem(e)}
}
