(() => {
'use strict';
const $ = id => document.getElementById(id);
const say = (s, bad=false) => { $('localStatus').textContent=s; $('localStatus').style.color=bad?'#ffc3ce':'#c8e8da'; };
const fmt = n => n > 1048576 ? (n/1048576).toFixed(1)+' MB' : (n/1024).toFixed(0)+' KB';
const MAX = 400*1048576;
let dbOpen, previewURL = '';
function db(){
  if(!dbOpen) dbOpen=new Promise((ok,no)=>{
    const r=indexedDB.open('raja-local-library',1);
    r.onupgradeneeded=()=>{
      if(!r.result.objectStoreNames.contains('items')) r.result.createObjectStore('items',{keyPath:'id'});
      if(!r.result.objectStoreNames.contains('blobs')) r.result.createObjectStore('blobs',{keyPath:'id'});
    };
    r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error);
  });
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
async function remove(id){
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
  const item={id:uid(),type:'file',name:file.name||'media',size:file.size,at:Date.now()};
  await write(item,file);
  return item;
}
async function importFiles(files){
  if(!files.length)return;
  let count=0;
  try{
    for(const f of files){
      if(!(/^(audio|video)\//.test(f.type)||/\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name)))continue;
      say('جاري حفظ '+f.name+' على هذا الجهاز...');
      await saveFile(f);count++;
    }
    say(count?'تم حفظ '+count+' من الملفات داخل مكتبتك المحلية دون رفعها إلى أي خادم.':'لم يتم اختيار ملفات صوت أو فيديو صالحة.');
  }catch(e){say(e.name==='QuotaExceededError'?'لا توجد مساحة تخزين كافية للموقع على جهازك.':(e.message||'تعذر الحفظ'),true);}
  await refresh();
}
function button(label,callback,danger=false){
  const b=document.createElement('button');b.type='button';b.className='lib-btn'+(danger?' danger':'');b.textContent=label;
  b.addEventListener('click',async()=>{b.disabled=true;try{await callback();}catch(e){say(e.message||'تعذرت العملية',true);}finally{b.disabled=false;}});
  return b;
}
async function showItem(item){
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
  if(!stored?.blob)throw Error('لم يتم العثور على الملف.');
  const u=URL.createObjectURL(stored.blob),a=document.createElement('a');
  a.href=u;a.download=item.name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),60000);
  say('أُرسل الملف إلى التنزيلات. على الآيفون قد تحتاج اختيار «حفظ في الملفات».');
}
async function refresh(){
  const items=(await read('items')).sort((a,b)=>b.at-a.at);
  const filtered=items.filter(x=>x.name.toLowerCase().includes($('localSearch').value.trim().toLowerCase()));
  $('localCount').textContent=items.filter(x=>x.type==='file').length+' ملفات محفوظة • '+items.filter(x=>x.type==='youtube').length+' روابط يوتيوب';
  const root=$('localItems');root.replaceChildren();
  if(!filtered.length){const p=document.createElement('p');p.textContent='لا توجد عناصر في المكتبة أو نتائج مطابقة.';p.className='muted';root.append(p);}
  for(const item of filtered){
    const row=document.createElement('div');row.className='lib-item';
    const copy=document.createElement('div');copy.className='lib-copy';
    const strong=document.createElement('strong');strong.textContent=item.name;
    const small=document.createElement('small');small.textContent=(item.type==='youtube'?'رابط مشاهدة فقط، وليس فيديو منزّلًا':fmt(item.size)+' — ملف مخزّن على هذا الجهاز')+' • '+new Date(item.at).toLocaleDateString('ar-SA');
    copy.append(strong,small);
    const actions=document.createElement('div');actions.className='line';
    actions.append(button(item.type==='youtube'?'مشاهدة':'تشغيل',()=>showItem(item)));
    if(item.type==='file')actions.append(button('حفظ في الملفات',()=>exportItem(item)));
    actions.append(button('حذف',async()=>{if(confirm('هل تريد حذف هذا العنصر من مكتبة الجهاز؟')){await remove(item.id);await refresh();say('تم الحذف من هذا الجهاز.');}},true));
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
$('localImport').addEventListener('change',async e=>{await importFiles([...e.target.files]);e.target.value='';});
$('file').addEventListener('change',e=>importFiles([...e.target.files]));
$('addToLibrary').addEventListener('click',saveCurrent);
$('localSearch').addEventListener('input',()=>refresh().catch(e=>say(e.message,true)));
$('persistStorage').addEventListener('click',async()=>{
  try{const granted=await navigator.storage?.persist?.();say(granted?'قبل المتصفح طلب الاحتفاظ ببيانات الموقع؛ احتفظ بنسخة احتياطية رغم ذلك.':'لم يضمن المتصفح استمرار حفظ البيانات؛ احفظ نسخة في ملفات جهازك.');}
  catch{say('لم يتمكن المتصفح من تثبيت التخزين.',true);}
});
if(!window.indexedDB)say('هذا المتصفح لا يدعم مكتبة الملفات المحلية.',true);
else refresh().catch(e=>say('تعذّر فتح المكتبة: '+e.message,true));
})();