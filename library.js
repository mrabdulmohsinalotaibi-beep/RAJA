(() => {
'use strict';
const $ = id => document.getElementById(id);
const say = (s, bad=false) => { $('localStatus').textContent=s; $('localStatus').style.color=bad?'#9c363d':'#31634d'; };
const fmt = n => n > 1048576 ? (n/1048576).toFixed(1)+' MB' : (n/1024).toFixed(0)+' KB';
const MAX = 400*1048576;
const MEDIA_ACCEPT='audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.mp4,.m4v,.mov,.webm';
const MIME_BY_EXT={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',flac:'audio/flac',mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
function mediaMime(file){
 const ext=String(file.name||'').trim().split('.').pop().toLowerCase();
 return MIME_BY_EXT[ext]||(/^(audio|video)\//.test(file.type||'')?file.type:'');
}
function importError(error){
 return error?.name==='QuotaExceededError'?'لا توجد مساحة تخزين كافية للموقع على جهازك.':error?.name==='NotReadableError'?'تعذر قراءة الملف. نزّله أولًا في تطبيق الملفات ثم اختره مجددًا.':error?.message||'تعذر حفظ الملف على هذا الجهاز.';
}
let dbOpen, previewURL = '';
async function db(){
  if(!dbOpen) dbOpen=(async()=>{
    const auth=await (window.rajaAuthReady||Promise.resolve({configured:false,user:null}));
    if(auth?.configured && !auth.user?.id && !auth.guestAllowed)throw Error('يرجى تسجيل الدخول أولًا.');
    const name=auth?.user?.id
      ? 'raja-personal-library-'+String(auth.user.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)
      : 'raja-local-library';
    return new Promise((ok,no)=>{
      const r=indexedDB.open(name,1);
      r.onupgradeneeded=()=>{
        if(!r.result.objectStoreNames.contains('items'))r.result.createObjectStore('items',{keyPath:'id'});
        if(!r.result.objectStoreNames.contains('blobs'))r.result.createObjectStore('blobs',{keyPath:'id'});
      };
      r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
    });
  })();
  return dbOpen;
}
async function write(item,blob){
  const d=await db();
  await new Promise((ok,no)=>{
    const tx=d.transaction(blob?['items','blobs']:['items'],'readwrite');
    tx.objectStore('items').put(item);
    if(blob) tx.objectStore('blobs').put({id:item.id,blob});
    tx.oncomplete=ok; tx.onerror=()=>no(tx.error); tx.onabort=()=>no(tx.error);
  });
}
async function read(store,id){
  const d=await db();
  return new Promise((ok,no)=>{
    const r=d.transaction(store,'readonly').objectStore(store)[id?'get':'getAll'](...(id?[id]:[]));
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
  });
}
async function removeLocal(id){
  const d=await db();
  await new Promise((ok,no)=>{
    const tx=d.transaction(['items','blobs'],'readwrite');
    tx.objectStore('items').delete(id);tx.objectStore('blobs').delete(id);
    tx.oncomplete=ok;tx.onerror=()=>no(tx.error);
  });
}
const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random();
async function saveFile(file){
  if(!file?.size) throw Error('الملف فارغ');
  if(file.size>MAX) throw Error('حجم الملف يتجاوز 400 ميجابايت؛ احفظه في ملفات جهازك مباشرة.');
  const mime=mediaMime(file);
  const item={id:uid(),type:'file',name:file.name||'media',mime,size:file.size,at:Date.now()};
  // Store a media Blob rather than the file-provider's File wrapper (notably on iOS).
  const blob=new Blob([file],{type:mime||file.type});
  await write(item,blob);
  return item;
}
async function importFiles(files,{onProgress}={}){
  const items=[],errors=[];
  for(const file of files){
    if(!mediaMime(file)){errors.push(file.name+': صيغة الملف غير مدعومة.');continue}
    const message='جارٍ حفظ '+file.name+' على هذا الجهاز...';say(message);onProgress?.(message);
    try{items.push(await saveFile(file))}catch(error){errors.push(file.name+': '+importError(error))}
  }
  const message=(items.length?'تم حفظ '+items.length+' من الملفات داخل مكتبتك المحلية. ':'')+errors.join(' ');
  say(message||'لم يتم اختيار ملفات.',!!errors.length);
  await refresh();
  if(items.length)window.dispatchEvent(new Event('raja-library-change'));
  return {items,errors};
}
function button(label,callback,danger=false){
  const b=document.createElement('button');b.type='button';b.className='lib-btn'+(danger?' danger':'');b.textContent=label;
  b.addEventListener('click',async()=>{b.disabled=true;try{await callback();}catch(e){say(e.message||'تعذرت العملية',true);}finally{b.disabled=false;}});
  return b;
}
async function showItem(item){
  if(window.rajaLessons){await window.rajaLessons.playLibraryItem(item);return}
  if(item.type==='youtube'){
    window.rajaShowPlayer?.();
    window.rajaOpenYoutube(item.videoId);
    say('تم فتح رابط يوتيوب للمشاهدة فقط؛ لم يُحفظ الفيديو كملف.');
  }else{
    const stored=await read('blobs',item.id);
    if(!stored?.blob)throw Error('لم يتم العثور على الملف المحفوظ.');
    window.rajaShowPlayer?.();
    if(previewURL)URL.revokeObjectURL(previewURL);
    previewURL=URL.createObjectURL(stored.blob);
    window.rajaLoadMedia(previewURL,item.name);
    say('تشغيل الملف مباشرة من مساحة الجهاز الخاصة بهذا المتصفح.');
  }
  $('player').scrollIntoView({behavior:'smooth',block:'center'});
}
async function exportItem(item){
  const stored=await read('blobs',item.id);
  if(!stored?.blob){const a=document.createElement('a');a.href='/api/cloud-file?id='+encodeURIComponent(item.id)+'&download=1';a.download=item.name;document.body.append(a);a.click();a.remove();say('بدأ حفظ نسخة من ملف الحساب على الجهاز.');return;}
  const u=URL.createObjectURL(stored.blob),a=document.createElement('a');
  a.href=u;a.download=item.name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),60000);
  say('أُرسل الملف إلى التنزيلات. على الآيفون قد تحتاج اختيار «حفظ في الملفات».');
}
async function refresh(){
  const items=(await read('items')).filter(x=>!x.deleted).sort((a,b)=>b.at-a.at);
  const filtered=items.filter(x=>x.name.toLowerCase().includes($('localSearch').value.trim().toLowerCase()));
  $('localCount').textContent=items.filter(x=>x.type==='file').length+' ملفات محفوظة • '+items.filter(x=>x.type==='youtube').length+' روابط يوتيوب';
  const root=$('localItems');root.replaceChildren();
  if(!filtered.length){const p=document.createElement('p');p.textContent='لا توجد عناصر في المكتبة أو نتائج مطابقة.';p.className='muted';root.append(p);}
  for(const item of filtered){
    const row=document.createElement('div');row.className='lib-item';
    const copy=document.createElement('div');copy.className='lib-copy';
    const strong=document.createElement('strong');strong.textContent=item.name;
    const small=document.createElement('small');small.textContent=(item.type==='youtube'?'رابط مشاهدة فقط، وليس فيديو منزّلًا':fmt(item.size)+(item.cloud?(item.local===false?' — محفوظ في الحساب؛ يتطلب الإنترنت':' — تمت المزامنة؛ متاح دون إنترنت'):' — محفوظ على هذا الجهاز؛ بانتظار المزامنة عند الدخول'))+' • '+new Date(item.at).toLocaleDateString('ar-SA');
    copy.append(strong,small);
    const actions=document.createElement('div');actions.className='line';
    actions.append(button(item.type==='youtube'?'مشاهدة':'تشغيل',()=>showItem(item)));
    if(item.type==='file'){
      actions.append(button('حفظ في الملفات',()=>exportItem(item)));
      if(item.cloud&&item.local===false)actions.append(button('حفظ دون إنترنت',async()=>{say('جارٍ حفظ نسخة للعمل دون إنترنت...');await getBlob(item.id);await refresh();say('أصبح الملف متاحًا دون إنترنت على هذا الجهاز.')}));
    }
    actions.append(button('حذف',async()=>{if(confirm(window.rajaAuthState?.()?.user?.id?'حذف هذا الملف من حسابك وأجهزتك المتزامنة؟':'هل تريد حذف هذا العنصر من مكتبة الجهاز؟')){if(window.rajaAuthState?.()?.user?.id)await write({...item,deleted:true});else await removeLocal(item.id);await refresh();window.dispatchEvent(new Event('raja-library-change'));say('تم الحذف؛ ستُزامن العملية عند الاتصال.');}},true));
    row.append(copy,actions);root.append(row);
  }
  if(navigator.storage?.estimate) {
    try{const e=await navigator.storage.estimate();$('localStorageUsage').textContent='المساحة المستخدمة للموقع: '+fmt(e.usage||0)+'؛ السعة المتاحة للمتصفح تختلف حسب الجهاز.';}catch{}
  }
}
let busy=false;
async function saveCurrent(){
  if(busy)return;
  const raw=$('url').value.trim();if(!raw){say('ألصق رابط الملف أولًا.',true);return;}
  busy=true;$('addToLibrary').disabled=true;
  try{
    const yt=window.rajaYoutubeId(raw);
    if(yt){
      await write({id:uid(),type:'youtube',videoId:yt,name:'مقطع يوتيوب '+yt,at:Date.now()});
      say('حفظت رابط يوتيوب للمشاهدة فقط. لا يمكن تنزيل ملف يوتيوب من مشغل التضمين.');
    }else{
      const u=new URL(raw);
      if(!['https:','http:'].includes(u.protocol)||!/\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg|flac|aac)([?#]|$)/i.test(u.href))throw Error('استخدم رابط ملف صوت أو فيديو مباشر؛ روابط صفحات المواقع ليست ملفات.');
      say('جاري تنزيل الملف المباشر وحفظه في جهازك...');
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),120000);
      let r;
      try{r=await fetch(u.href,{mode:'cors',credentials:'omit',signal:ctrl.signal});}finally{clearTimeout(timer);}
      if(!r.ok)throw Error('لم يسمح الخادم بتنزيل الملف: '+r.status);
      if(Number(r.headers.get('content-length')||0)>MAX)throw Error('حجم الملف أكبر من 400 ميجابايت.');
      const mime=r.headers.get('content-type')||'';
      if(/text\/html|application\/json|text\/plain/i.test(mime))throw Error('الاستجابة صفحة وليست ملف وسائط.');
      const blob=await r.blob();
      if(blob.size>MAX)throw Error('حجم الملف أكبر من 400 ميجابايت.');
      let name=decodeURIComponent(u.pathname.split('/').pop()||'media');
      name=name.replace(/[\\/:*?"<>|]/g,'_').slice(0,150);
      await saveFile(new File([blob],name,{type:mime}));
      say('نجح تنزيل الملف وحفظه في المكتبة المحلية. يمكنك تشغيله أو نقله إلى مجلد الملفات.');
    }
    await refresh();
  }catch(e){
    say(e.name==='QuotaExceededError'?'المساحة المتاحة لا تكفي لهذا الملف.':e.name==='AbortError'?'انتهت مهلة التنزيل.':e instanceof TypeError?'الخادم الخارجي لا يسمح للتطبيق بتنزيل هذا الرابط (CORS أو اتصال).':(e.message||'تعذر الحفظ'),true);
  }finally{busy=false;$('addToLibrary').disabled=false;}
}
for(const id of ['localImport','file']){
  $(id).accept=MEDIA_ACCEPT;
  $(id).addEventListener('change',async e=>{
    const picker=e.target;picker.disabled=true;
    try{
      const result=await importFiles([...picker.files]);
      if(id==='file'){
        $('notice').textContent=result.errors.join(' ')||'تم حفظ الملف في «ملفاتي».';
        if(result.items[0])await showItem(result.items[0]);
      }
    }catch(error){say(importError(error),true);if(id==='file')$('notice').textContent=importError(error)}
    finally{picker.disabled=false;if(id==='localImport')picker.value=''}
  });
}
$('addToLibrary').addEventListener('click',saveCurrent);
$('localSearch').addEventListener('input',()=>refresh().catch(e=>say(e.message,true)));
$('persistStorage').addEventListener('click',async()=>{
  try{const granted=await navigator.storage?.persist?.();say(granted?'قبل المتصفح طلب الاحتفاظ ببيانات الموقع؛ احتفظ بنسخة احتياطية رغم ذلك.':'لم يضمن المتصفح استمرار حفظ البيانات؛ احفظ نسخة في ملفات جهازك.');}
  catch{say('لم يتمكن المتصفح من تثبيت التخزين.',true);}
});

const LOCAL_YOUTUBE_LIMIT=120*1024*1024;
const progressWrap=$('localDownloadProgressWrap');
const progressBar=$('localDownloadProgress');
const progressLabel=$('localDownloadProgressLabel');
function setProgress(stage, bytes=0, total=0){
  if(!progressWrap||!progressBar||!progressLabel)return;
  progressWrap.hidden=false;
  if(stage==='pending'){
    progressBar.removeAttribute('value');
    progressLabel.textContent='جارٍ تجهيز الملف على الخادم...';
  }else if(stage==='downloading'){
    if(total>0){
      progressBar.value=Math.min(100,Math.round(bytes/total*100));
      progressLabel.textContent=progressBar.value+'٪';
    }else{
      progressBar.removeAttribute('value');
      progressLabel.textContent=fmt(bytes)+' تم استلامها';
    }
  }else if(stage==='done'){
    progressBar.value=100;progressLabel.textContent='تم الحفظ بنجاح';
  }else if(stage==='error'){
    progressBar.value=0;progressLabel.textContent='لم يكتمل حفظ الملف';
  }
}

async function getBlob(id){
 const stored=await read('blobs',id);if(stored?.blob)return stored.blob;
 const item=await read('items',id);if(!item?.cloud||item.deleted)return null;
 const response=await fetch('/api/cloud-file?id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw Error('تعذر تنزيل ملف الحساب. تحقق من الاتصال والدخول.');
 const blob=await response.blob();if(blob.size!==item.size)throw Error('لم يكتمل تنزيل الملف.');
 await write({...item,local:true},blob);return blob;
}
window.rajaLibrary={
 items:async()=>(await read('items')).filter(x=>!x.deleted),rawItems:()=>read('items'),rawBlob:async id=>(await read('blobs',id))?.blob,
 getBlob,importFiles,mediaAccept:MEDIA_ACCEPT,
 async source(id){
  const item=await read('items',id),stored=await read('blobs',id);
  if(!item||item.deleted)throw Error('الملف محذوف من المكتبة.');
  if(stored?.blob)return {blob:stored.blob,mime:item.mime||stored.blob.type};
  if(item.cloud)return {url:'/api/cloud-file?id='+encodeURIComponent(id),mime:item.mime};
  throw Error('الملف غير موجود على هذا الجهاز ولم تكتمل مزامنته.');
 },
 async applyCloud(files,links){
  const current=await read('items'),map=new Map(current.map(x=>[x.id,x]));
  for(const file of files){const local=map.get(file.id);if(file.status==='deleted'){if(local&&!local.deleted)await removeLocal(file.id);continue}if(local?.deleted)continue;await write({...local,...file,type:'file',cloud:true,local:local?local.local!==false:false})}
  const cloudLinks=new Map(links.map(x=>[x.id,x]));
  for(const item of current)if(item.type==='youtube'&&!cloudLinks.has(item.id))await removeLocal(item.id);
  for(const link of links)await write(link);
  await refresh();window.dispatchEvent(new Event('raja-cloud-library-applied'));
 },
 async markUploaded(id){const item=await read('items',id);if(item&&!item.deleted){await write({...item,cloud:true,local:true});await refresh()}},
 async forgetDeleted(id){await removeLocal(id)},
 async importGuest(){
  const guest=await new Promise((ok,no)=>{const r=indexedDB.open('raja-local-library',1);r.onupgradeneeded=()=>{for(const store of ['items','blobs'])if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store,{keyPath:'id'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  const all=store=>new Promise((ok,no)=>{const r=guest.transaction(store).objectStore(store).getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  try{const [items,blobs]=await Promise.all([all('items'),all('blobs')]),existing=new Set((await read('items')).map(x=>x.id)),byId=new Map(blobs.map(x=>[x.id,x.blob]));for(const item of items)if(!existing.has(item.id)&&!item.deleted)await write({...item,cloud:false},byId.get(item.id));await refresh();window.dispatchEvent(new Event('raja-library-change'));return items.length}finally{guest.close()}
 }
};
window.rajaLibrarySaveYouTubeMedia=async function({videoId,kind,format,quality}) {
  if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)||!['mp4','mp3'].includes(format)||!['audio','video'].includes(kind)||!/^\d{2,4}$/.test(String(quality))) {
    say('خيارات الحفظ غير صالحة.',true);
    return false;
  }
  if(format==='mp4'&&kind!=='video'||format==='mp3'&&kind!=='audio')return false;
  const params=new URLSearchParams({id:videoId,kind,format,quality:String(quality)});
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),180000);
  const filename='raja-'+videoId+'.'+format;
  const formatStatus=document.getElementById('formatNotice');
  function announce(msg,bad=false){
    say(msg,bad);
    if(formatStatus){formatStatus.textContent=msg;formatStatus.classList.toggle('format-warning',bad);}
  }
  setProgress('pending');
  announce('جاري تنزيل '+filename+' إلى مكتبتك في هذا الجهاز...');
  try{
    const response=await fetch('/api/download?'+params,{signal:ctrl.signal,cache:'no-store'});
    if(!response.ok){
      const problem=await response.json().catch(()=>null);
      throw Error(problem?.message||'تعذر تنزيل المقطع من YouTube ('+response.status+')');
    }
    const mime=response.headers.get('content-type')||'';
    if(!mime.startsWith(format==='mp3'?'audio/':'video/'))throw Error('المصدر لم يعطِ ملف وسائط صالحًا.');
    const expected=Number(response.headers.get('content-length')||0);
    setProgress('downloading',0,expected);
    if(expected>LOCAL_YOUTUBE_LIMIT)throw Error('ملف كبير جدًا للحفظ الداخلي (الحد 120 ميجابايت). استخدم زر «تنزيل إلى جهازي» لحفظه في تطبيق الملفات.');
    let blob;
    if(response.body?.getReader){
      const reader=response.body.getReader();
      const chunks=[];let received=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        if(value){
          received+=value.byteLength;
          setProgress('downloading',received,expected);
          if(received>LOCAL_YOUTUBE_LIMIT){
            await reader.cancel();
            throw Error('تجاوز الملف 120 ميجابايت. استخدم التنزيل المباشر إلى تطبيق الملفات.');
          }
          chunks.push(value);
          const progress=expected?' ('+Math.min(99,Math.round(received/expected*100))+'٪)':' ('+fmt(received)+')';
          announce('جاري حفظ '+filename+progress);
        }
      }
      blob=new Blob(chunks,{type:mime});
    }else{
      blob=await response.blob();
      if(blob.size>LOCAL_YOUTUBE_LIMIT)throw Error('الملف أكبر من مساحة الحفظ الداخلي المسموحة.');
    }
    if(!blob.size)throw Error('لم تصل بيانات الفيديو.');
    await saveFile(new File([blob],filename,{type:mime}));
    await refresh();
    window.dispatchEvent(new Event('raja-library-change'));
    setProgress('done');
    announce('تم تنزيل '+filename+' وحفظه بنجاح داخل «ملفاتي» على هذا الجهاز.');
    return true;
  }catch(err){
    const msg=err.name==='AbortError'?'انتهت مهلة حفظ الملف.':err.name==='QuotaExceededError'?'المساحة المتاحة في هذا الجهاز لا تكفي.':(err.message||'تعذر حفظ الملف.');
    setProgress('error');
    announce(msg,true);return false;
  }finally{clearTimeout(timeout)}
};
if(!window.indexedDB)say('هذا المتصفح لا يدعم مكتبة الملفات المحلية.',true);
else refresh().catch(e=>say('تعذّر فتح المكتبة: '+e.message,true));
})();