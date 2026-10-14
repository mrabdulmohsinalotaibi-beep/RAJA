/* Account-only cloud sync. Offline originals remain in the existing IndexedDB library. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),core=window.RajaSyncCore,empty=()=>({lessons:[],links:[]});
let user=null,baseKey='',base=empty(),running=false,timer=null,again=false,ready=false,lastError='';
function status(message,bad=false){for(const id of ['cloudSyncStatus','cloudAccountStatus']){const el=$(id);if(el){el.textContent=message;el.style.color=bad?'#9c363d':'#31634d'}}}
async function api(path,options={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
 try{const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal}),data=await response.json().catch(()=>({}));if(!response.ok&&!data.conflict)throw Object.assign(Error(data.message||'تعذر الاتصال بخدمة المزامنة.'),{status:response.status});return data}finally{clearTimeout(timeout)}
}
const send=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function localSnapshot(){
 const links=(await window.rajaLibrary.items()).filter(x=>x.type==='youtube').map(({id,name,videoId,at})=>({id,type:'youtube',name,videoId,at}));
 return {lessons:window.rajaLessons.snapshot(),links};
}
function storeBase(value){localStorage.setItem(baseKey,JSON.stringify(value));base=value}
async function syncData(){
 let remote=await api('/api/sync');
 for(let attempt=0;attempt<4;attempt++){
  const before=await localSnapshot(),merged=core.merge(base,before,remote.data);
  let ack=remote;
  if(!core.equal(merged,remote.data)){
   ack=await api('/api/sync',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:remote.version,data:merged})});
   if(ack.conflict){remote={...remote,...ack};continue}
  }
  const current=await localSnapshot(),next=core.merge(before,current,ack.data);
  // Save the acknowledged server baseline before applying local edits made during the request.
  storeBase(ack.data);
  if(!core.equal(current.lessons,next.lessons))window.rajaLessons.applyCloud(next.lessons);
  await window.rajaLibrary.applyCloud(remote.files||[],next.links);
  if(!core.equal(next,ack.data))again=true;
  const usage=$('cloudStorageUsage');if(usage)usage.textContent='سعة الحساب المستخدمة: '+(remote.used/1048576).toFixed(1)+' من '+Math.round(remote.limit/1048576)+' ميجابايت. الحد للملف الواحد 400 ميجابايت.';
  return;
 }
 throw Error('تتغير البيانات على جهاز آخر؛ ستعاد المزامنة مع الاحتفاظ بنسخة جهازك.');
}
async function uploadFiles(){
 const items=await window.rajaLibrary.rawItems();let count=0;
 for(const item of items){
  if(item.deleted){if(item.type==='file')await api('/api/cloud-file?id='+encodeURIComponent(item.id),{method:'DELETE'});await window.rajaLibrary.forgetDeleted(item.id);continue}
  if(item.type!=='file'||item.cloud)continue;
  const blob=await window.rajaLibrary.rawBlob(item.id);if(!blob)continue;
  try{
   status('جارٍ مزامنة '+item.name+'…');
   const init=await send('/api/cloud-file',{action:'init',id:item.id,name:item.name,size:blob.size,at:item.at});
   if(!init.ready){
    const parts=new Set(init.parts),total=Math.ceil(blob.size/init.chunkSize);
    for(let n=1;n<=total;n++){
     if(!parts.has(n))await api('/api/cloud-file?id='+encodeURIComponent(item.id)+'&part='+n,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:blob.slice((n-1)*init.chunkSize,Math.min(n*init.chunkSize,blob.size))});
     status('رفع '+item.name+' • '+Math.round(n/total*100)+'٪');
    }
    await send('/api/cloud-file',{action:'complete',id:item.id});
   }
   await window.rajaLibrary.markUploaded(item.id);count++;
  }catch(error){
   if(error.status===410){await window.rajaLibrary.forgetDeleted(item.id);continue}
   lastError=item.name+': '+(error.name==='AbortError'?'انتهت مهلة الاتصال؛ سيُستأنف الرفع تلقائيًا.':error.message);status(lastError,true);
  }
 }
 return count;
}
async function sync(){
 clearTimeout(timer);if(!ready)return;
 if(running){again=true;return}
 if(!navigator.onLine){status('دون اتصال — تغييراتك محفوظة على الجهاز وستُزامن عند عودة الإنترنت.');return}
 running=true;again=false;lastError='';status('جارٍ مزامنة حسابك…');
 try{
  await syncData();const uploaded=await uploadFiles();if(uploaded)await syncData();
  const pending=(await window.rajaLibrary.rawItems()).filter(i=>i.deleted||(i.type==='file'&&!i.cloud));
  if(lastError)status(lastError,true);else status(pending.length?'تمت مزامنة القوائم؛ تبقّى '+pending.length+' ملفات للرفع.':'تمت مزامنة حسابك • '+new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}));
 }catch(error){status(error.status===401?'انتهت جلسة الدخول. سجل الدخول لاستكمال المزامنة؛ ملفات الجهاز محفوظة.':error.message||'تعذرت المزامنة؛ النسخة المحلية محفوظة.',true)}
 finally{running=false;if(again)schedule(2500)}
}
function schedule(delay=2000){if(!ready)return;if(running){again=true;return}if(timer&&delay>0)return;clearTimeout(timer);timer=setTimeout(()=>{timer=null;void sync()},delay)}
window.addEventListener('raja-library-change',()=>schedule());
window.addEventListener('raja-lessons-change',()=>schedule(10000));
window.addEventListener('online',()=>schedule(0));window.addEventListener('offline',()=>status('دون اتصال — تغييراتك محفوظة محليًا.'));
window.addEventListener('focus',()=>schedule(0));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0)});
$('cloudSyncRetry').onclick=()=>void sync();
$('importGuestLibrary').onclick=async()=>{
 if(!user)return;
 if(!confirm('رفع ملفات مكتبة الضيف وقوائمها الموجودة على هذا الجهاز إلى حسابك الحالي؟ تبقى النسخة الأصلية على الجهاز.'))return;
 const b=$('importGuestLibrary');b.disabled=true;
 try{
  await window.rajaLibrary.importGuest();
  const guest=JSON.parse(localStorage.getItem('raja-lessons-v1-local')||'[]');
  const current=window.rajaLessons.snapshot(),ids=new Set(current.map(x=>x.id));
  window.rajaLessons.applyCloud([...current,...guest.filter(x=>!ids.has(x.id))]);
  schedule(0);status('أُضيفت مكتبة الجهاز إلى حسابك؛ جارٍ رفع الملفات.');
 }catch(error){status(error.message||'تعذر نقل مكتبة الجهاز.',true)}finally{b.disabled=false}
};
(async()=>{
 const auth=await window.rajaAuthReady;await window.rajaLessonsReady;
 user=auth?.user;if(!user){status('سجل الدخول لمزامنة الملفات والقوائم بين أجهزتك.');$('cloudSyncRetry').hidden=true;return}
 baseKey='raja-cloud-base-v1-'+user.id;
 try{base=JSON.parse(localStorage.getItem(baseKey)||'null')||empty()}catch{base=empty()}
 $('importGuestLibrary').hidden=false;ready=true;await sync();
 setInterval(()=>{if(!document.hidden)void sync()},45000);
})().catch(error=>status(error.message||'تعذر بدء المزامنة.',true));
window.rajaCloudSync={sync};
})();
