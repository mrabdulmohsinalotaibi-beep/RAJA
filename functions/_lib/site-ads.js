import {json} from './google-auth.js';
import {audit,now} from './admin-auth.js';
export function validImage(value){
 if(value==='')return true;if(typeof value!=='string'||value.length>164000)return false;
 const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!m)return false;
 try{const b=atob(m[2]);if(b.length>120000||b.length<12)return false;return m[1]==='jpeg'?b.charCodeAt(0)===255&&b.charCodeAt(1)===216&&b.charCodeAt(2)===255:m[1]==='png'?b.startsWith('\x89PNG\r\n\x1a\n'):b.startsWith('RIFF')&&b.slice(8,12)==='WEBP'}catch{return false}
}
export function validLink(value){if(value==='')return true;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&value.length<=1000}catch{return false}}
export async function publicAds(env){if(!env?.RAJA_DB)return [];const rows=await env.RAJA_DB.prepare("SELECT id,title,description,link,version,(image!='') has_image FROM raja_ads WHERE enabled=1 ORDER BY created_at DESC,id LIMIT 8").all();return rows.results.map(a=>({...a,image:a.has_image?'/api/ad-image?id='+encodeURIComponent(a.id)+'&v='+a.version:''}))}
export async function manageAds(method,body,env,admin){
 const bad=(message,status=400)=>json({ok:false,message},status);
 if(method==='GET'){const rows=await env.RAJA_DB.prepare("SELECT id,title,description,link,enabled,version,created_at,image FROM raja_ads ORDER BY created_at DESC,id LIMIT 8").all();return json({ok:true,ads:rows.results})}
 if(!['save','toggle','delete'].includes(body.action))return bad('إجراء الإعلان غير صالح.');
 const id=body.id;let row;if(id){if(typeof id!=='string'||id.length>60)return bad('الإعلان غير صالح.');row=await env.RAJA_DB.prepare('SELECT id,version FROM raja_ads WHERE id=?').bind(id).first();if(!row)return bad('الإعلان غير موجود.',404);if(body.version!==row.version)return bad('تم تعديل الإعلان من جلسة أخرى. حدّث القائمة وحاول مجددًا.',409)}
 if(body.action!=='save'&&!row)return bad('اختر الإعلان أولًا.');
 if(body.action==='delete'){const r=await env.RAJA_DB.prepare('DELETE FROM raja_ads WHERE id=? AND version=?').bind(id,row.version).run();if(r.meta.changes!==1)return bad('تغيّر الإعلان. حدّث القائمة.',409)}
 else if(body.action==='toggle'){if(typeof body.enabled!=='boolean')return bad('حالة الإعلان غير صالحة.');const r=await env.RAJA_DB.prepare('UPDATE raja_ads SET enabled=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(Number(body.enabled),now(),id,row.version).run();if(r.meta.changes!==1)return bad('تغيّر الإعلان. حدّث القائمة.',409)}
 else{
  if(typeof body.title!=='string'||!body.title.trim()||body.title.length>80||typeof body.description!=='string'||body.description.length>180||typeof body.link!=='string'||!validLink(body.link)||typeof body.enabled!=='boolean'||(body.image!==undefined&&!validImage(body.image)))return bad('تحقق من عنوان الإعلان والرابط والصورة. الرابط يبدأ بـ https والصورة JPG أو PNG أو WebP.');
  const values=[body.title.trim(),body.description.trim(),body.link,Number(body.enabled)];let r;
  if(row){const image=body.image!==undefined;r=await env.RAJA_DB.prepare('UPDATE raja_ads SET title=?,description=?,link=?,enabled=?,version=version+1,updated_at=?'+(image?',image=?':'')+' WHERE id=? AND version=?').bind(...values,now(),...(image?[body.image]:[]),id,row.version).run()}
  else{r=await env.RAJA_DB.prepare('INSERT INTO raja_ads(id,title,description,link,enabled,image,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM raja_ads)<8').bind('ad-'+crypto.randomUUID(),...values,body.image||'',now(),now()).run()}
  if(r.meta.changes!==1)return bad(row?'تغيّر الإعلان. حدّث القائمة.':'يمكن حفظ 8 إعلانات كحد أقصى. احذف إعلانًا قديمًا أولًا.',409);
 }
 await audit(env,admin.id,'ad-'+body.action,id||'new').run();return json({ok:true});
}
