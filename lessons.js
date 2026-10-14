/* Account-scoped sequential lessons. Media stays in the existing device library. */
(() => {
'use strict';
const $=id=>document.getElementById(id),core=window.RajaLessons;
const audio=$('lessonAudio'),video=$('lessonVideo');
let selectedId='',lists=[],scope='',library=[],active=null,media=null,objectURL='',yt=null,ytReady=null;
let generation=0,transition=false,timer=null,lastSave=0;
const uid=()=>crypto.randomUUID();
const fmt=n=>{n=Math.max(0,Math.floor(n||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const tell=(text,bad=false)=>{const el=$('lessonStatus');el.textContent=text;el.style.color=bad?'#9c363d':'#31634d'};
function save(notify=true){
 if(!scope)return false;
 try{localStorage.setItem(scope,JSON.stringify(lists));if(notify)window.dispatchEvent(new Event('raja-lessons-change'));return true}
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
 list.day=null;list.cursor=null;
}
function changeStructure(list,fn){
 if((list.day?.furthest>0||active?.list===list)&&!confirm('تغيير محتويات القائمة أو ترتيبها يعيد خطة الاستماع لهذه القائمة من البداية. متابعة؟'))return;
 resetPlan(list);fn();save();render();
}
async function reloadLibrary(){
 try{library=await window.rajaLibrary.items();render()}catch(e){tell(e.message,true)}
}
function render(){
 const root=$('lessonLists');root.replaceChildren();
 if(!lists.length){const p=document.createElement('p');p.textContent='أنشئ قائمة ثم أضف ملفات جهازك أو روابط دروسك.';root.append(p)}
 for(const list of lists){
  const box=document.createElement('article');box.className='lesson-list';box.dataset.lessonList=list.id;
  const h=document.createElement('h3');h.textContent=list.name;box.append(h);
  const desc=document.createElement('p');desc.className='raja-tip';
  const day=core.ensureDay(list);
  desc.textContent=list.items.length+' دروس • '+day.minutes+' دقيقة يوميًا • اليوم يبدأ '+list.start+' بتوقيت السعودية • تقدم اليوم '+fmt(day.furthest);
  box.append(desc);
  const controls=document.createElement('div');controls.className='org-actions';
  const play=button('تشغيل حصة اليوم',()=>start(list));play.disabled=!list.items.length;
  controls.append(play,button('تعديل الإعدادات',()=>{settings.hidden=!settings.hidden}),button('حذف القائمة',()=>{
   if(!confirm('حذف قائمة الدروس؟ الملفات الأصلية تبقى في ملفاتي.'))return;
   if(active?.list===list)stop();lists=lists.filter(x=>x!==list);save();render();
  }));box.append(controls);
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
   const t=document.createElement('strong');t.textContent=(index+1)+'. '+item.title;
   const actions=document.createElement('div');actions.className='org-actions';
   const up=button('↑',()=>changeStructure(list,()=>{[list.items[index-1],list.items[index]]=[item,list.items[index-1]]}));up.setAttribute('aria-label','تقديم '+item.title);up.disabled=index===0;
   const down=button('↓',()=>changeStructure(list,()=>{[list.items[index+1],list.items[index]]=[item,list.items[index+1]]}));down.setAttribute('aria-label','تأخير '+item.title);down.disabled=index===list.items.length-1;
   actions.append(up,down,button('تسمية',()=>{const name=prompt('اسم الدرس',item.title);if(name?.trim()){item.title=name.trim().slice(0,150);save();render()}}),button('حذف',()=>changeStructure(list,()=>list.items.splice(index,1))));
   row.append(t,actions);box.append(row);
  });root.append(box);
 }
}
function clearSource(){
 clearInterval(timer);timer=null;
 if(media){media.onplay=media.onpause=media.onended=media.ontimeupdate=media.onloadedmetadata=media.onerror=null;media.pause();media.removeAttribute('src');media.load();media=null}
 if(yt){try{yt.destroy()}catch{}yt=null}
 if(objectURL){URL.revokeObjectURL(objectURL);objectURL=''}
 audio.hidden=true;video.hidden=true;$('lessonYoutubeWrap').hidden=true;
}
function stop(persist=true){
 generation++;active=null;clearSource();transition=false;$('lessonNow').hidden=true;
 if(navigator.mediaSession){navigator.mediaSession.playbackState='none';navigator.mediaSession.metadata=null}
 try{if(navigator.audioSession)navigator.audioSession.type='auto'}catch{}
 if(persist)save();
}
function pause(){if(media){if(!media.paused)media.pause()}else yt?.pauseVideo()}
async function resume(){
 if(!active)return;
 if(core.dayKey(Date.now(),active.list.start)!==active.day.key){stop();tell('بدأ يوم استماع جديد. اضغط تشغيل حصة اليوم.');return}
 if(active.done)return start(active.list);
 try{if(media){try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}await media.play()}else yt?.playVideo()}catch{tell('اضغط تشغيل داخل المشغل للمتابعة.',true)}
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
function fail(e){transition=false;pause();save();tell((e?.message||'تعذر تشغيل الدرس.')+' أعد المحاولة أو تحقق من وجود الملف في «ملفاتي».',true)}
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
async function openItem(item,offset){
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
   onReady:event=>{if(token!==generation)return;transition=false;event.target.seekTo(offset,true);event.target.playVideo();timer=setInterval(()=>tick(),200)},
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
   else throw Error('ملف الدرس غير موجود على هذا الجهاز.');
  }
  if(token!==generation)return;
  const isAudio=(item.mime||mime).startsWith('audio/')||[item.title,item.url].some(value=>/\.(mp3|m4a|aac|ogg|opus|wav|flac)([?#]|$)/i.test(String(value||'').trim()));
  media=isAudio?audio:video;media.hidden=false;
  const player=media;
  player.onloadedmetadata=()=>{
   if(token!==generation)return;
   if(!Number.isFinite(player.duration)||player.duration<=0){fail(Error('الحصص اليومية تحتاج ملفًا محدد المدة، وليس بثًا مباشرًا.'));return}
   player.currentTime=Math.min(offset,player.duration);transition=false;
   void player.play().catch(()=>tell('اضغط زر التشغيل داخل المشغل؛ المتصفح يحتاج لمسة لبدء الصوت.'));
  };
  player.ontimeupdate=()=>tick();player.onended=()=>tick(true);
  player.onerror=()=>{if(token===generation)fail(Error('صيغة الملف أو رابط الدرس غير قابل للتشغيل.'))};
  player.onplay=()=>{
   $('lessonPause').textContent='إيقاف مؤقت';
   if(active?.done)void start(active.list);
  };
  player.onpause=()=>{$('lessonPause').textContent='متابعة';tick();save()};
  player.src=src;player.load();timer=setInterval(()=>tick(),200);
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
  installSession(item);
 }
}
async function start(list){
 stop();if(!list.items.length)return;
 const day=core.ensureDay(list);
 const item=list.items.find(x=>x.id===day.start.id)||list.items[0];
 selectedId=list.id;try{localStorage.setItem(scope+':selected',selectedId)}catch{}
 active={list,day,item,offset:day.start.offset,spent:0,done:false,history:[]};
 window.rajaRecorderHome?.();
 $('lessonNow').hidden=false;$('lessonDailyProgress').value=0;$('lessonProgress').textContent='جارٍ تجهيز حصة اليوم...';
 $('player').pause();$('youtube').removeAttribute('src');
 save();tell('هذه حصة اليوم؛ إعادة التشغيل تعيدها من بدايتها.');
 try{await openItem(item,day.start.offset)}catch(e){fail(e)}
}

window.rajaLessons={
 snapshot:()=>JSON.parse(JSON.stringify(lists)),
 applyCloud(next){
  if(active){const incoming=next.find(l=>l.id===active.list.id),shape=l=>JSON.stringify([l.minutes,l.start,l.items.map(i=>[i.id,i.type,i.type==='file'?i.libraryId:i.type==='youtube'?i.videoId:i.url])]);
   if(!incoming||shape(incoming)!==shape(active.list))stop();
   else{Object.assign(active.list,incoming);active.day=core.ensureDay(active.list);next=next.map(l=>l.id===active.list.id?active.list:l)}
  }
  lists=next;save(false);render();
 },
 state(){
  const list=active?.list||lists.find(l=>l.id===selectedId)||lists[0];
  if(!list)return null;
  const day=core.ensureDay(list),item=active?.item||list.items.find(i=>i.id===day.start.id)||list.items[0];
  return {name:list.name,title:item?.title||'أضف دروسك إلى القائمة',index:list.items.findIndex(i=>i.id===item?.id)+1,count:list.items.length,
   minutes:day.minutes,start:list.start,position:active?position():0,duration:active?duration():0,
   elapsed:active?active.spent+Math.max(0,position()-active.offset):0,
   playing:!!active&&!active.done&&(media?!media.paused:yt?.getPlayerState?.()===1),
   picture:!!active&&(active.item.type==='youtube'||media===video),active:!!active,done:!!active?.done};
 },
 async toggle(){
  if(!active){const list=lists.find(l=>l.id===selectedId)||lists[0];if(list?.items.length)return start(list);window.rajaSwitchTab?.('organizer');tell('أنشئ قائمة وأضف دروسك أولًا.');return}
  if(active.done||media?.paused||yt?.getPlayerState?.()===2)return resume();pause();
 },
 replay(){if(active)return start(active.list);const list=lists.find(l=>l.id===selectedId)||lists[0];if(list)return start(list)},
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
$('lessonReplay').onclick=()=>{if(active)void start(active.list)};
$('lessonStop').onclick=stop;
$('lessonCreate').onsubmit=e=>{
 e.preventDefault();if(!scope)return;
 const name=$('lessonName').value.trim(),minutes=Number($('lessonMinutes').value),start=$('lessonStart').value;
 if(!name||!Number.isInteger(minutes)||minutes<1||minutes>720||!/^\d{2}:\d{2}$/.test(start))return;
 if(lists.length>=50)return tell('الحد الأقصى 50 قائمة دروس.',true);
 lists.push({id:uid(),name,minutes,start,items:[],cursor:null,day:null});
 if(save()){$('lessonName').value='';render();tell('أُنشئت القائمة. أضف دروسك بترتيب الاستماع. يتم الحفظ على هذا الجهاز.')}
};
window.addEventListener('raja-other-playback',()=>stop());
$('player').addEventListener('play',()=>{if(active)stop()});
window.addEventListener('raja-library-change',()=>void reloadLibrary());
window.addEventListener('raja-cloud-library-applied',()=>void reloadLibrary());
window.addEventListener('pagehide',()=>{tick();save()});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&active?.item.type==='youtube')pause();
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
 try{selectedId=localStorage.getItem(scope+':selected')||''}catch{}
 try{const stored=JSON.parse(localStorage.getItem(scope)||'[]');if(Array.isArray(stored))lists=stored}catch{tell('تعذر قراءة القوائم السابقة.',true)}
 await reloadLibrary();
})().catch(e=>tell(e.message,true));
})();
