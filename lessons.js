/* Account-scoped sequential lessons. Media stays in the existing device library. */
(() => {
'use strict';
const $=id=>document.getElementById(id),core=window.RajaLessons;
const audio=$('lessonAudio'),video=$('lessonVideo');
let selectedId='',lists=[],scope='',library=[],active=null,media=null,objectURL='',yt=null,ytReady=null;
let generation=0,transition=false,timer=null,lastSave=0,audioRearmTimer=null;
let checkpoints={};
const signature=list=>JSON.stringify([list.minutes,list.start,list.items.map(i=>[i.id,i.type,i.libraryId||i.videoId||i.url||''])]);
function checkpointFor(list){
 const value=checkpoints[list.id];
 return value&&value.dayKey===core.dayKey(Date.now(),list.start)&&value.signature===signature(list)&&list.items.some(i=>i.id===value.itemId)&&Number.isFinite(value.position)&&value.position>=0&&Number.isFinite(value.spent)&&value.spent>=0&&Number.isFinite(value.offset)&&value.offset>=0?value:null;
}
function selectedList(){return lists.find(l=>l.id===selectedId)||checkpoints[selectedId]?.previewList||lists[0]}
function capturePosition(){
 if(!active||!media&&!yt||transition)return;
 const a=active,d=duration(),t=position();
 if(!Number.isFinite(t)||!Number.isFinite(d)||d<=0)return;
 const elapsed=Math.min(a.day.minutes*60,a.spent+Math.max(0,t-a.offset));
 const record={listId:a.list.id,itemId:a.item.id,position:t,offset:a.offset,spent:a.spent,elapsed,duration:d,dayKey:a.day.key,signature:signature(a.list),done:a.done,history:a.history,at:Date.now()};
 if(t>=d-0.025&&!a.done){const next=a.list.items[a.list.items.findIndex(i=>i.id===a.item.id)+1];if(next)Object.assign(record,{itemId:next.id,position:0,offset:0,spent:elapsed,duration:0})}
 if(!lists.some(l=>l.id===a.list.id))record.previewList=a.list;
 checkpoints[a.list.id]=record;
}
const uid=()=>crypto.randomUUID();
const fmt=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const tell=(text,bad=false)=>{const el=$('lessonStatus');el.textContent=text;el.style.color=bad?'#9c363d':'#31634d'};
function save(notify=true){
 if(!scope)return false;
 try{capturePosition();localStorage.setItem(scope,JSON.stringify(lists));localStorage.setItem(scope+':positions',JSON.stringify(checkpoints));if(notify)window.dispatchEvent(new Event('raja-lessons-change'));return true}
 catch{tell('تعذر حفظ قوائم الدروس. تحقق من المساحة وإعدادات المتصفح.',true);return false}
}
function button(text,fn){
 const b=document.createElement('button');b.type='button';b.className='org-btn';b.textContent=text;
 b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){tell(e.message||'تعذرت العملية.',true)}finally{b.disabled=false}};return b;
}
function input(label,type,value){
 const l=document.createElement('label');l.textContent=label;
 const i=document.createElement('input');i.type=type;i.value=value;l.append(i);return {label:l,input:i};
}
function resetPlan(list){
 if(active?.list===list)stop();
 list.day=null;list.cursor=null;delete checkpoints[list.id];
}
function changeStructure(list,fn){
 if((list.day?.furthest>0||active?.list===list)&&!confirm('تغيير محتويات القائمة أو ترتيبها يعيد خطة الاستماع لهذه القائمة من البداية. متابعة؟'))return;
 resetPlan(list);fn();save();render();
}
async function reloadLibrary(){
 try{library=await window.rajaLibrary.items();render()}catch(e){tell(e.message,true)}
}
function selectList(id){
 const list=lists.find(l=>l.id===id);if(!list)return;
 stop();selectedId=id;
 try{localStorage.setItem(scope+':selected',id)}catch{}
 render();tell('تم اختيار '+list.name+'؛ اضغط تشغيل للمتابعة.');
}
const parseTime=value=>{
 const parts=String(value).trim().replace(/[٠-٩]/g,n=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).split(':');
 if(parts.length<2||parts.length>3||parts.some(p=>!/^\d{1,5}$/.test(p)))return null;
 if(Number(parts.at(-1))>=60||(parts.length===3&&Number(parts[1])>=60))return null;
 return parts.reduce((n,p)=>n*60+Number(p),0);
};
async function itemDuration(item){
 if(item.type==='youtube')return 0;
 let url=item.url,temporary='';
 if(item.type==='file'){
  const source=window.rajaLibrary.source?await window.rajaLibrary.source(item.libraryId):{blob:await window.rajaLibrary.getBlob(item.libraryId)};
  if(source.blob){temporary=URL.createObjectURL(source.blob);url=temporary}else url=source.url;
 }
 if(!url)throw Error('المقطع غير محفوظ على هذا الجهاز. أعد إضافته في ملفاتي.');
 const probe=document.createElement('audio');probe.preload='metadata';
 try{return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(Error('تعذر قراءة مدة المقطع. تحقق من الملف أو الاتصال ثم أعد المحاولة.')),12000);
  const finish=(error,value)=>{clearTimeout(timer);probe.onloadedmetadata=probe.onerror=null;error?reject(error):resolve(value)};
  probe.onloadedmetadata=()=>Number.isFinite(probe.duration)&&probe.duration>0?finish(null,probe.duration):finish(Error('اختر مقطعًا محدد المدة.'));
  probe.onerror=()=>finish(Error('تعذرت قراءة هذا المقطع. تحقق من الملف أو الرابط.'));
  probe.src=url;probe.load();
 })}finally{probe.removeAttribute('src');probe.load();if(temporary)URL.revokeObjectURL(temporary)}
}
function todayEditor(list){
 const form=document.createElement('form');form.className='lesson-form lesson-today-form';form.hidden=true;form.dataset.todayEditor=list.id;
 const heading=document.createElement('h4');heading.textContent='تعديل حصة اليوم';heading.className='wide';
 const note=document.createElement('p');note.className='raja-tip wide';note.textContent='اختر المقطع وموضع البداية. حفظ التعديل يعيد احتساب مدة حصة اليوم من هذا الموضع، دون تغيير ترتيب القائمة. يمكنك التقديم أو الرجوع في أي وقت.';
 const label=document.createElement('label');label.textContent='بداية الحصة من المقطع';label.className='wide';
 const picker=document.createElement('select');picker.setAttribute('aria-label','مقطع بداية حصة اليوم');
 list.items.forEach((item,i)=>{const o=document.createElement('option');o.value=item.id;o.textContent=(i+1)+'. '+item.title;picker.append(o)});label.append(picker);
 const time=input('الموضع في المقطع (دقائق:ثوانٍ أو ساعات:دقائق:ثوانٍ)','text','0:00');time.label.className='wide';time.input.dir='ltr';time.input.inputMode='text';time.input.required=true;time.input.setAttribute('aria-label','موضع بداية حصة اليوم');time.input.placeholder='12:35';
 const adjust=document.createElement('div');adjust.className='org-actions wide';
 const move=delta=>{const index=list.items.findIndex(i=>i.id===picker.value),item=list.items[index+delta];if(item){picker.value=item.id;time.input.value='0:00';status.textContent=''}};
 adjust.append(button('المقطع السابق',()=>move(-1)),button('المقطع التالي',()=>move(1)));
 adjust.append(button('رجوع 10 ثوانٍ',()=>{time.input.value=fmt(Math.max(0,(parseTime(time.input.value)||0)-10))}),button('تقديم 10 ثوانٍ',()=>{time.input.value=fmt((parseTime(time.input.value)||0)+10)}));
 const status=document.createElement('p');status.className='raja-tip wide';status.setAttribute('role','status');
 const submit=document.createElement('button');submit.type='submit';submit.textContent='حفظ حصة اليوم';
 const cancel=button('إلغاء',()=>{form.hidden=true});cancel.className+=' wide';
 form.append(heading,note,label,time.label,adjust,status,submit,cancel);
 const open=(itemId=null)=>{
  const day=core.ensureDay(list);const saved=checkpointFor(list);
  picker.value=itemId||((active?.list===list?active.item.id:saved?.itemId)||day.start.id)||list.items[0]?.id;
  time.input.value=fmt(itemId?0:active?.list===list?position():saved?.position??day.start.offset);
  status.textContent='';form.hidden=false;form.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 };
 picker.onchange=()=>{time.input.value='0:00';status.textContent=''};
 form.onsubmit=async e=>{
  e.preventDefault();const offset=parseTime(time.input.value),item=list.items.find(i=>i.id===picker.value);
  if(offset===null||!item){status.textContent='أدخل وقتًا صحيحًا مثل 12:35 أو 1:02:30.';return}
  const before=signature(list);submit.disabled=true;status.textContent='جارٍ التحقق من موضع البداية...';
  try{
   const measured=await itemDuration(item);
   if(measured&&offset>=measured){status.textContent='اختر وقتًا قبل نهاية المقطع ('+fmt(measured)+').';return}
   if(!lists.includes(list))return;
   if(signature(list)!==before){status.textContent='تغيّرت القائمة. افتح تعديل الحصة مرة أخرى.';return}
   if(active?.list===list)stop();
   const point={id:item.id,offset};
   list.day={key:core.dayKey(Date.now(),list.start),start:{...point},furthest:0,next:{...point},minutes:list.minutes};list.cursor={...point};
   checkpoints[list.id]={listId:list.id,itemId:item.id,position:offset,offset,spent:0,elapsed:0,duration:measured,dayKey:list.day.key,signature:signature(list),done:false,history:[],at:Date.now()};
   if(!active){selectedId=list.id;try{localStorage.setItem(scope+':selected',selectedId)}catch{}}
   if(save()){render();tell('حُفظت حصة '+list.name+' من '+item.title+' عند '+fmt(offset)+'. اضغط تشغيل متى أردت.')}
   else status.textContent='تعذر حفظ التعديل. تحقق من مساحة الجهاز.';
  }catch(e){status.textContent=e.message||'تعذر تعديل الحصة.'}finally{submit.disabled=false}
 };
 return {form,open};
}
function render(){
 const root=$('lessonLists');root.replaceChildren();
 if($('lessonListCount'))$('lessonListCount').textContent=lists.length+' من 50 قائمة · لكل قائمة حصة مستقلة';
 const availableIds=new Set(library.map(item=>item.id));
 if(!lists.length){const p=document.createElement('p');p.textContent='أنشئ قائمة ثم أضف ملفات جهازك أو روابط دروسك.';root.append(p)}
 for(const list of lists){
  const box=document.createElement('article');box.className='lesson-list';box.dataset.lessonList=list.id;box.dataset.selected=String(list.id===selectedId);
  const today=todayEditor(list);
  const h=document.createElement('h3');h.textContent=list.name;box.append(h);
  const desc=document.createElement('p');desc.className='raja-tip';
  const day=core.ensureDay(list);
  const missing=list.items.filter(item=>item.type==='file'&&!availableIds.has(item.libraryId));
  desc.textContent=list.items.length+' دروس • '+day.minutes+' دقيقة يوميًا • اليوم يبدأ '+list.start+' بتوقيت السعودية • تقدم اليوم '+fmt(day.furthest)+(missing.length?' • '+missing.length+' مقاطع غير محفوظة على هذا الجهاز':'');
  box.append(desc);
  const controls=document.createElement('div');controls.className='org-actions';
  const play=button('تشغيل حصة اليوم',()=>start(list));play.disabled=!list.items.length||!!missing.length;
  if(missing.length){
   play.title='هذه القائمة تتضمن مقاطع ليست محفوظة على الجهاز. أعد إضافتها أو أزل مراجعها من القائمة.';
   controls.append(button('إزالة المقاطع غير الموجودة هنا',()=>changeStructure(list,()=>{
    const unavailable=new Set(missing.map(item=>item.id));
    list.items=list.items.filter(item=>!unavailable.has(item.id));
   })));
  }
  const editToday=button('تعديل حصة اليوم',()=>today.open());editToday.disabled=!list.items.length;
  controls.append(play,editToday,button('اختيار القائمة',()=>selectList(list.id)),button('تعديل الإعدادات',()=>{settings.hidden=!settings.hidden}),button('حذف القائمة',()=>{
   if(!confirm('حذف قائمة الدروس؟ الملفات الأصلية تبقى في ملفاتي.'))return;
   if(active?.list===list)stop();delete checkpoints[list.id];lists=lists.filter(x=>x!==list);save();render();
  }));box.append(controls,today.form);
  const settings=document.createElement('form');settings.className='lesson-form';settings.hidden=true;
  const name=input('اسم القائمة','text',list.name),minutes=input('دقائق يوميًا','number',list.minutes),begin=input('بداية اليوم بتوقيت السعودية','time',list.start);
  name.input.required=true;name.input.maxLength=100;minutes.input.required=true;minutes.input.min=1;minutes.input.max=720;begin.input.required=true;
  const submit=document.createElement('button');submit.type='submit';submit.textContent='حفظ الإعدادات';
  settings.append(name.label,minutes.label,begin.label,submit);
  settings.onsubmit=e=>{
   e.preventDefault();const n=Number(minutes.input.value),s=begin.input.value;
   if(!name.input.value.trim()||!Number.isInteger(n)||n<1||n>720||!/^\d{2}:\d{2}$/.test(s))return;
   const planChanged=n!==list.minutes||s!==list.start;
   if(planChanged&&!confirm('تغيير المدة أو بداية اليوم يعيد خطة هذه القائمة من البداية. متابعة؟'))return;
   if(planChanged)resetPlan(list);
   list.name=name.input.value.trim();list.minutes=n;list.start=s;save();render();
  };box.append(settings);
  const add=document.createElement('details');const summary=document.createElement('summary');summary.textContent='إضافة دروس إلى القائمة';add.append(summary);
  const fileLabel=document.createElement('label');fileLabel.textContent='ملفات من الجهاز (تُضاف بترتيب الأسماء)';
  const files=document.createElement('input');files.type='file';files.accept=window.rajaLibrary.mediaAccept||'audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.flac';files.multiple=true;fileLabel.append(files);
  files.onchange=async()=>{
   try{
    const selected=[...files.files].sort((a,b)=>a.name.localeCompare(b.name,'ar',{numeric:true}));
    if(list.items.length+selected.length>500)throw Error('الحد الأقصى 500 درس للقائمة.');
    if((list.day?.furthest||active?.list===list)&&!confirm('إضافة دروس تعيد خطة القائمة من البداية. متابعة؟'))return;
    files.disabled=true;
    const result=await window.rajaLibrary.importFiles(selected,{onProgress:message=>tell(message)});
    const imported=result.items.sort((a,b)=>a.name.localeCompare(b.name,'ar',{numeric:true}));
    if(imported.length){resetPlan(list);for(const item of imported)list.items.push({id:uid(),type:'file',libraryId:item.id,mime:item.mime,title:item.name});save();render()}
    tell((imported.length?'تمت إضافة '+imported.length+' دروس إلى القائمة. ':'')+result.errors.join(' '),!!result.errors.length);
   }catch(e){tell(e.message,true)}finally{files.value='';files.disabled=false}
  };add.append(fileLabel);
  const picker=document.createElement('select');picker.setAttribute('aria-label','درس من ملفاتي');
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='اختر من ملفاتي';picker.append(placeholder);
  for(const item of library){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;picker.append(o)}
  add.append(picker,button('إضافة من ملفاتي',()=>{
   const item=library.find(x=>x.id===picker.value);if(!item)return tell('اختر ملفًا أولًا.',true);
   if(list.items.length>=500)return tell('الحد الأقصى 500 درس.',true);
   changeStructure(list,()=>list.items.push({id:uid(),type:item.type,libraryId:item.id,videoId:item.videoId,mime:item.mime,title:item.name}));
  }));
  const linkForm=document.createElement('form');linkForm.className='lesson-form';
  const title=input('اسم الدرس','text',''),url=input('رابط ملف مباشر أو YouTube','url','');
  title.input.required=true;title.input.maxLength=150;url.input.required=true;
  const addLink=document.createElement('button');addLink.type='submit';addLink.textContent='إضافة الرابط';linkForm.append(title.label,url.label,addLink);
  linkForm.onsubmit=e=>{
   e.preventDefault();if(list.items.length>=500)return tell('الحد الأقصى 500 درس.',true);
   const u=new URL(url.input.value);if(u.protocol!=='https:')return tell('استخدم رابط HTTPS آمنًا.',true);
   const id=window.rajaYoutubeId(u.href);
   if(!id&&!/\.(mp3|m4a|aac|ogg|wav|flac|mp4|m4v|mov|webm)([?#]|$)/i.test(u.href))return tell('أضف رابط ملف صوت أو فيديو مباشر، أو رابط YouTube.',true);
   changeStructure(list,()=>list.items.push({id:uid(),type:id?'youtube':'url',url:u.href,videoId:id,title:title.input.value.trim()}));
  };add.append(linkForm);box.append(add);
  list.items.forEach((item,index)=>{
   const row=document.createElement('div');row.className='lesson-row';
   const t=document.createElement('strong');t.textContent=(index+1)+'. '+item.title+(item.type==='file'&&!availableIds.has(item.libraryId)?' — غير محفوظ على هذا الجهاز':'');
   const actions=document.createElement('div');actions.className='org-actions';
   const up=button('↑',()=>changeStructure(list,()=>{[list.items[index-1],list.items[index]]=[item,list.items[index-1]]}));up.setAttribute('aria-label','تقديم '+item.title);up.disabled=index===0;
   const down=button('↓',()=>changeStructure(list,()=>{[list.items[index+1],list.items[index]]=[item,list.items[index+1]]}));down.setAttribute('aria-label','تأخير '+item.title);down.disabled=index===list.items.length-1;
   actions.append(button('ابدأ الحصة من هنا',()=>today.open(item.id)),up,down,button('تسمية',()=>{const name=prompt('اسم الدرس',item.title);if(name?.trim()){item.title=name.trim().slice(0,150);save();render()}}),button('حذف',()=>changeStructure(list,()=>list.items.splice(index,1))));
   row.append(t,actions);box.append(row);
  });root.append(box);
 }
}
function activateAudioSession(rearm=false){
 const session=navigator.audioSession;if(!session)return;
 clearTimeout(audioRearmTimer);audioRearmTimer=null;
 try{
  if(!rearm){session.type='playback';return}
  // WebKit can retain a stale playback category after a GPU/audio-process restart.
  // Reasserting the same value is deduplicated; a distinct category + new task
  // forces the platform session to be configured again without reloading media.
  session.type='ambient';
  audioRearmTimer=setTimeout(()=>{
   audioRearmTimer=null;
   if(media&&!media.paused&&active){try{session.type='playback'}catch{}}
  },0);
 }catch{try{session.type='playback'}catch{}}
}
function clearSource(){
 clearTimeout(audioRearmTimer);audioRearmTimer=null;
 clearInterval(timer);timer=null;
 if(media){media.onplay=media.onpause=media.onended=media.ontimeupdate=media.onloadedmetadata=media.onerror=null;media.pause();media.removeAttribute('src');media.load();media=null}
 if(yt){try{yt.destroy()}catch{}yt=null}
 if(objectURL){URL.revokeObjectURL(objectURL);objectURL=''}
 audio.hidden=true;video.hidden=true;$('lessonYoutubeWrap').hidden=true;
}
function stop(persist=true){
 if(persist&&active)save();
 generation++;active=null;clearSource();transition=false;$('lessonNow').hidden=true;
 if(navigator.mediaSession){navigator.mediaSession.playbackState='none';navigator.mediaSession.metadata=null}
 try{if(navigator.audioSession)navigator.audioSession.type='auto'}catch{}
 if(persist)save();
}
function pause(){if(media){if(!media.paused)media.pause()}else yt?.pauseVideo()}
async function resume(){
 if(!active)return;
 if(core.dayKey(Date.now(),active.list.start)!==active.day.key){stop();tell('بدأ يوم استماع جديد. اضغط تشغيل حصة اليوم.');return}
 if(active.done)return start(active.list,{replay:true});
 try{if(media){activateAudioSession();await media.play()}else yt?.playVideo()}catch{tell('اضغط تشغيل داخل المشغل للمتابعة.',true)}
}
function installSession(item){
 if(!navigator.mediaSession)return;
 if(typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({title:item.title,artist:'رَجْع — '+active.list.name,album:'حصة '+active.day.key});
 // Keep native play/pause/stop routing: iOS can resume the existing media
 // element while the page's JavaScript is suspended in the background.
 navigator.mediaSession.playbackState='none';
 const handlers={play:null,pause:null,stop:null,seekbackward:d=>seekBy(-(d.seekOffset||10)),seekforward:d=>seekBy(d.seekOffset||10),seekto:d=>seekTo(d.seekTime)};
 for(const [action,handler] of Object.entries(handlers)){try{navigator.mediaSession.setActionHandler(action,handler)}catch{}}
}
function seekTo(time){
 if(!active||transition)return;
 const end=Math.min(duration(),active.offset+active.day.minutes*60-active.spent);
 const t=Math.max(active.offset,Math.min(end,Number(time)||0));
 if(media)media.currentTime=t;else yt?.seekTo(t,true);
 tick();
}
function seekBy(delta){seekTo(position()+delta)}
const position=()=>media?media.currentTime:yt?.getCurrentTime?.()||0;
const duration=()=>media?media.duration:yt?.getDuration?.()||0;
function tick(ended=false){
 if(!active||transition||active.done)return;
 const a=active;
 if(core.dayKey(Date.now(),a.list.start)!==a.day.key){stop();tell('بدأ يوم جديد. اضغط تشغيل حصة اليوم للمتابعة.');return}
 const d=duration();if(!Number.isFinite(d)||d<=0)return;
 const max=a.day.minutes*60;
 let t=ended?d:position();
 if(t<a.offset){if(media)media.currentTime=a.offset;else yt?.seekTo(a.offset,true);return}
 const segmentEnd=Math.min(d,a.offset+max-a.spent);
 t=Math.min(t,segmentEnd);
 const elapsed=a.spent+Math.max(0,t-a.offset);
 const index=a.list.items.findIndex(x=>x.id===a.item.id);
 const next=t>=d-0.025?{id:a.list.items[index+1]?.id||null,offset:0}:{id:a.item.id,offset:t};
 core.remember(a.list,elapsed,next);
 $('lessonDailyProgress').value=Math.min(100,elapsed/max*100);
 $('lessonProgress').textContent='حصة اليوم '+fmt(elapsed)+' / '+fmt(max)+' • الدرس '+(index+1)+' من '+a.list.items.length;
 if(navigator.mediaSession&&media){
  try{navigator.mediaSession.setPositionState({duration:d,playbackRate:media.playbackRate,position:Math.max(0,Math.min(t,d))})}catch{}
 }
 if(Date.now()-lastSave>1000){lastSave=Date.now();save()}
 if(elapsed>=max-0.025){
  pause();if(media&&Math.abs(media.currentTime-segmentEnd)>0.1)media.currentTime=segmentEnd;
  a.done=true;save();tell('اكتملت حصة اليوم. يمكنك إعادتها؛ اليوم التالي يتابع من نهايتها.');
 }else if(ended||t>=d-0.025){
  if(index+1<a.list.items.length){
   transition=true;a.spent=elapsed;
   void openItem(a.list.items[index+1],0).catch(fail);
  }else{
   pause();a.done=true;save();tell('اكتملت القائمة. إعادة حصة اليوم متاحة، وفي اليوم التالي تبدأ القائمة من أولها.');
  }
 }
}
function fail(e){transition=false;pause();save();tell(e?.message||'تعذر تشغيل الدرس على هذا الجهاز.',true)}
async function youtubeAPI(){
 if(window.YT?.Player)return window.YT;
 if(!ytReady)ytReady=new Promise((resolve,reject)=>{
  const old=window.onYouTubeIframeAPIReady;
  const timeout=setTimeout(()=>{ytReady=null;reject(Error('تعذر تحميل مشغل YouTube.'))},15000);
  window.onYouTubeIframeAPIReady=()=>{old?.();clearTimeout(timeout);resolve(window.YT)};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  script.onerror=()=>{clearTimeout(timeout);ytReady=null;script.remove();reject(Error('تعذر الاتصال بـ YouTube.'))};document.head.append(script);
 });return ytReady;
}
async function openItem(item,offset,playFrom=offset){
 const token=++generation;transition=true;clearSource();
 if(!active)return;
 active.item=item;active.offset=offset;active.done=false;
 if(!active.history.some(h=>h.id===item.id))active.history.push({id:item.id,offset,spent:active.spent});
 $('lessonNowTitle').textContent=active.list.name+' — '+item.title;
 if(item.type==='youtube'){
  const YT=await youtubeAPI();if(token!==generation)return;
  $('lessonYoutubeWrap').hidden=false;
  const host=document.createElement('div');host.id='lessonYoutube';$('lessonYoutubeWrap').replaceChildren(host);
  yt=new YT.Player(host,{host:'https://www.youtube-nocookie.com',videoId:item.videoId,playerVars:{playsinline:1,rel:0,origin:location.origin},events:{
   onReady:event=>{if(token!==generation)return;transition=false;event.target.seekTo(playFrom,true);event.target.playVideo();timer=setInterval(()=>tick(),200)},
   onStateChange:event=>{if(token!==generation)return;if(event.data===0)tick(true)},
   onError:()=>{if(token===generation)fail(Error('هذا الفيديو غير متاح للتضمين.'))}
  }});
 }else{
  let src=item.url,mime='';
  if(item.type==='file'){
   const source=window.rajaLibrary.source?await window.rajaLibrary.source(item.libraryId):{blob:await window.rajaLibrary.getBlob(item.libraryId)};
   if(token!==generation)return;
   if(source.blob){objectURL=URL.createObjectURL(source.blob);src=objectURL;mime=source.mime||source.blob.type}
   else if(source.url){src=source.url;mime=source.mime||''}
   else throw Error('ملف الدرس غير محفوظ على هذا الجهاز. أعد إضافته في «ملفاتي».');
  }
  if(token!==generation)return;
  const isAudio=(item.mime||mime).startsWith('audio/')||[item.title,item.url].some(value=>/\.(mp3|m4a|aac|ogg|opus|wav|flac)([?#]|$)/i.test(String(value||'').trim()));
  media=isAudio?audio:video;media.hidden=false;
  const player=media;
  player.onloadedmetadata=()=>{
   if(token!==generation)return;
   if(!Number.isFinite(player.duration)||player.duration<=0){fail(Error('الحصص اليومية تحتاج ملفًا محدد المدة، وليس بثًا مباشرًا.'));return}
   player.currentTime=Math.min(playFrom,player.duration);transition=false;save(false);
   void player.play().catch(()=>tell('اضغط زر التشغيل داخل المشغل؛ المتصفح يحتاج لمسة لبدء الصوت.'));
  };
  player.ontimeupdate=()=>tick();player.onended=()=>tick(true);
  player.onerror=()=>{if(token===generation)fail(Error('صيغة الملف أو رابط الدرس غير قابل للتشغيل.'))};
  player.onplay=()=>{
   $('lessonPause').textContent='إيقاف مؤقت';
   if(active?.done)void start(active.list,{replay:true});else activateAudioSession(true);
  };
  player.onpause=()=>{$('lessonPause').textContent='متابعة';tick();save()};
  player.src=src;player.load();timer=setInterval(()=>tick(),200);
  activateAudioSession();
  installSession(item);
 }
}
async function start(list,{replay=false}={}){
 stop();if(!list.items.length)return;
 const available=new Set((await window.rajaLibrary.items()).map(item=>item.id));
 if(list.items.some(item=>item.type==='file'&&!available.has(item.libraryId))){
  tell('تحتوي القائمة على مقاطع غير محفوظة على هذا الجهاز. أعد إضافتها أو أزلها من القائمة.',true);
  window.rajaSwitchTab?.('organizer');return;
 }
 const day=core.ensureDay(list),saved=replay?null:checkpointFor(list),point=saved&&!saved.done?saved:null;
 if(replay)delete checkpoints[list.id];
 const item=list.items.find(x=>x.id===(point?.itemId||day.start.id))||list.items[0];
 selectedId=list.id;try{localStorage.setItem(scope+':selected',selectedId)}catch{}
 active={list,day,item,offset:point?.offset??day.start.offset,spent:point?.spent??0,done:false,history:Array.isArray(point?.history)?point.history:[]};
 window.rajaRecorderHome?.();
 $('lessonNow').hidden=false;$('lessonDailyProgress').value=0;$('lessonProgress').textContent='جارٍ تجهيز حصة اليوم...';
 $('player').pause();$('youtube').removeAttribute('src');
 save();tell(point?'متابعة من موضع التوقف '+fmt(point.position)+'؛ زر إعادة الحصة يبدأها من جديد.':'هذه حصة اليوم؛ زر إعادة الحصة يعيدها من بدايتها.');
 try{await openItem(item,active.offset,point?.position??day.start.offset)}catch(e){fail(e)}
}

window.rajaLessons={
 snapshot:()=>JSON.parse(JSON.stringify(lists)),
 listOptions:()=>lists.map(l=>({id:l.id,name:l.name})),
 selectList,
 importLocalLists(guest){
  if(!Array.isArray(guest))return 0;
  const ids=new Set(lists.map(list=>list.id));
  const extra=guest.filter(list=>list&&typeof list.id==='string'&&Array.isArray(list.items)&&!ids.has(list.id)).slice(0,Math.max(0,50-lists.length));
  if(extra.length){lists.push(...extra);save();render()}
  return extra.length;
 },
 state(){
  const list=active?.list||selectedList();
  if(!list)return null;
  const day=core.ensureDay(list),saved=checkpointFor(list),item=active?.item||list.items.find(i=>i.id===(saved?.itemId||day.start.id))||list.items[0];
  return {listId:list.id,name:list.name,title:item?.title||'أضف دروسك إلى القائمة',index:list.items.findIndex(i=>i.id===item?.id)+1,count:list.items.length,
   minutes:day.minutes,start:list.start,position:active?position():saved?.position??day.start.offset,duration:active?duration():saved?.duration||0,
   elapsed:active?active.spent+Math.max(0,position()-active.offset):saved?.elapsed||0,resumable:!active&&!!saved&&!saved.done,
   playing:!!active&&!active.done&&(media?!media.paused:yt?.getPlayerState?.()===1),
   picture:!!active&&(active.item.type==='youtube'||media===video),active:!!active,done:active?!!active.done:!!saved?.done};
 },
 async toggle(){
  if(!active){const list=selectedList();if(list?.items.length)return start(list);window.rajaSwitchTab?.('organizer');tell('أنشئ قائمة وأضف دروسك أولًا.');return}
  if(active.done||media?.paused||yt?.getPlayerState?.()===2)return resume();pause();
 },
 replay(){if(active)return start(active.list,{replay:true});const list=selectedList();if(list)return start(list,{replay:true})},
 seek:seekTo,seekBy,
 async step(direction){
  if(!active||transition||active.done)return;
  if(direction>0){tick(true);return}
  const index=active.list.items.findIndex(i=>i.id===active.item.id);
  const previous=active.list.items[index-1],history=active.history.find(h=>h.id===previous?.id);
  if(!history){seekTo(active.offset);return}
  active.spent=history.spent;
  try{await openItem(previous,history.offset)}catch(e){fail(e)}
 },
 stop,
 async playLibraryItem(item){
  const found=lists.find(l=>l.items.some(i=>i.libraryId===item.id));
  if(found)return start(found);
  const list={id:'preview-'+item.id,name:'ملفاتي',minutes:720,start:'05:00',items:[{id:item.id,type:item.type,libraryId:item.id,videoId:item.videoId,mime:item.mime,title:item.name}]};
  return start(list);
 }
};

$('lessonPause').onclick=()=>{if(media?.paused||yt?.getPlayerState?.()===2)void resume();else pause()};
$('lessonReplay').onclick=()=>{if(active)void start(active.list,{replay:true})};
$('lessonStop').onclick=stop;
$('lessonCreate').onsubmit=e=>{
 e.preventDefault();if(!scope)return;
 const name=$('lessonName').value.trim(),minutes=Number($('lessonMinutes').value),start=$('lessonStart').value;
 if(!name||!Number.isInteger(minutes)||minutes<1||minutes>720||!/^\d{2}:\d{2}$/.test(start))return;
 if(lists.length>=50)return tell('الحد الأقصى 50 قائمة دروس.',true);
 const created={id:uid(),name,minutes,start,items:[],cursor:null,day:null};lists.push(created);
 if(!active){selectedId=created.id;try{localStorage.setItem(scope+':selected',selectedId)}catch{}}
 if(save()){$('lessonName').value='';render();tell('أُنشئت القائمة رقم '+lists.length+'. أضف دروسك بترتيب الاستماع. يتم الحفظ على هذا الجهاز.')}
};
window.addEventListener('raja-other-playback',()=>stop());
$('player').addEventListener('play',()=>{if(active)stop()});
window.addEventListener('raja-library-change',()=>void reloadLibrary());
window.addEventListener('pagehide',()=>{tick();save()});
window.addEventListener('pageshow',()=>{if(media&&!media.paused)activateAudioSession(true)});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&active?.item.type==='youtube')pause();
 if(!document.hidden&&media&&!media.paused)activateAudioSession(true);
 // Do not pause native media on lock or while switching applications.
 tick();save();
});
window.addEventListener('storage',e=>{
 if(e.key!==scope)return;
 stop(false);try{lists=JSON.parse(e.newValue||'[]');render();tell('تم تحديث القوائم من نافذة أخرى.')}catch{}
});
window.rajaLessonsReady=(async()=>{
 const auth=await window.rajaAuthReady;
 if(auth?.configured&&!auth.user?.id&&!auth.guestAllowed)return;
 scope='raja-lessons-v1-'+(auth?.user?.id?auth.user.id:'local');
 try{selectedId=localStorage.getItem(scope+':selected')||'';const stored=JSON.parse(localStorage.getItem(scope+':positions')||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))checkpoints=stored}catch{}
 try{const stored=JSON.parse(localStorage.getItem(scope)||'[]');if(Array.isArray(stored))lists=stored}catch{tell('تعذر قراءة القوائم السابقة.',true)}
 await reloadLibrary();
 const importButton=$('importGuestLibrary');
 if(auth?.user?.id&&importButton){
  importButton.hidden=false;
  importButton.onclick=async()=>{
   if(!confirm('إضافة الملفات والقوائم المحفوظة في مكتبة الضيف على هذا الجهاز إلى حسابك هنا فقط؟ لن تُرفع أو تُزامن.'))return;
   importButton.disabled=true;
   try{
    const count=await window.rajaLibrary.importGuest();
    const guest=JSON.parse(localStorage.getItem('raja-lessons-v1-local')||'[]');
    const listsAdded=window.rajaLessons.importLocalLists(guest);
    await reloadLibrary();
    tell('تم فحص '+count+' عناصر وإضافة '+listsAdded+' قوائم من مكتبة هذا الجهاز. لا توجد مزامنة سحابية.');
   }catch(e){tell(e.message||'تعذر استيراد مكتبة الضيف.',true)}
   finally{importButton.disabled=false}
  };
 }
})().catch(e=>tell(e.message,true));
})();
