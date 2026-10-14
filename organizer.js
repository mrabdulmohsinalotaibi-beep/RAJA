/* RAJA device-only organizer: favorites, playlists, timed clips and reminders never synchronize. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const LIMIT=150;
let data={favorites:[],playlists:[],clips:[]},scope='';
let currentVideo=null,reminderTimer=null;
const validId=id=>/^[A-Za-z0-9_-]{11}$/.test(id||'');
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const empty=()=>({favorites:[],playlists:[],clips:[]});
function notice(text,bad=false){const n=$('organizerStatus');n.textContent=text;n.style.color=bad?'#9c363d':'#31634d'}
function currentId(){return window.rajaYoutubeId?.($('url')?.value.trim()||'')||currentVideo}
function seconds(text) {
 const s=String(text||'').trim();
 if(!s)return NaN;
 if(/^\d+$/.test(s))return Number(s);
 const a=s.split(':').map(Number);
 if(a.length<2||a.length>3||a.some(n=>!Number.isInteger(n)||n<0))return NaN;
 if(a.slice(1).some(n=>n>59))return NaN;
 return a.reduce((total,n)=>total*60+n,0);
}
function hhmm(n){
 n=Math.max(0,Math.floor(n));
 return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].filter((_,i)=>i>0||n>=3600).map(v=>String(v).padStart(2,'0')).join(':');
}
function readLocal(){
 try{
  const parsed=JSON.parse(localStorage.getItem(scope)||'null');
  if(parsed&&Array.isArray(parsed.favorites)&&Array.isArray(parsed.playlists)&&Array.isArray(parsed.clips))return parsed;
 }catch{}
 return empty();
}
function storeLocal(){
 try{localStorage.setItem(scope,JSON.stringify(data));}
 catch{notice('لم تتوفر مساحة لحفظ البيانات محليًا.',true)}
}
function authScope(){
 const state=window.rajaAuthState?.();
 if(state?.configured&&!state.user?.id&&!state.guestAllowed)return null;
 return state?.user?.id?'raja-organizer-'+state.user.id:'raja-organizer-local';
}
async function bootstrap(){
 await (window.rajaAuthReady||Promise.resolve());
 const value=authScope();
 if(!value){$('organizerSection').hidden=true;return}
 $('organizerSection').hidden=false;
 scope=value;data=readLocal();render();
 notice('المفضلة والقوائم والأجزاء الزمنية محفوظة على هذا الجهاز فقط؛ لا تتم مزامنتها مع أي جهاز آخر.');
}
function changed(message){
 storeLocal();render();notice(message);
}
function btn(title,onClick){
 const b=document.createElement('button');b.type='button';b.className='org-btn';b.textContent=title;b.onclick=onClick;return b;
}
function addRow(container,title,subtitle,onPlay,onRemove){
 const item=document.createElement('article');item.className='org-item';
 const description=document.createElement('div');description.className='org-desc';
 const h=document.createElement('strong');h.textContent=title;
 const small=document.createElement('small');small.textContent=subtitle;
 description.append(h,small);
 const actions=document.createElement('div');actions.className='org-actions';
 actions.append(btn('تشغيل',onPlay),btn('حذف',onRemove));
 item.append(description,actions);container.append(item);
}
function play(id,start=0,end=0){
 window.dispatchEvent(new Event('raja-other-playback'));
 currentVideo=id;
 window.rajaSwitchTab?.('search');
 $('playerDetails').open=true;
 const video=$('player'),iframe=$('youtube');
 video.pause();video.hidden=true;video.removeAttribute('src');video.load();
 const url=new URL('https://www.youtube-nocookie.com/embed/'+id);
 url.searchParams.set('rel','0');
 if(start>0)url.searchParams.set('start',String(start));
 if(end>start)url.searchParams.set('end',String(end));
 iframe.src=url.href;iframe.hidden=false;
 $('featured').textContent=end>start?'تشغيل المقطع '+hhmm(start)+' – '+hhmm(end):'مشاهدة يوتيوب';
 iframe.scrollIntoView({behavior:'smooth',block:'center'});
}
function render(){
 const f=$('organizerFavorites'),p=$('organizerPlaylists'),c=$('organizerClips');
 f.replaceChildren();p.replaceChildren();c.replaceChildren();
 $('organizerCount').textContent=data.favorites.length+' مفضلة • '+data.playlists.length+' قوائم • '+data.clips.length+' أجزاء زمنية';
 if(!data.favorites.length)f.textContent='لم تحفظ مقاطع في المفضلة بعد.';
 for(const item of data.favorites)addRow(f,item.title||'مقطع يوتيوب',item.videoId,
  ()=>play(item.videoId),()=>{data.favorites=data.favorites.filter(x=>x.videoId!==item.videoId);changed('حُذف من المفضلة.')});
 if(!data.playlists.length)p.textContent='لا توجد قوائم بعد.';
 for(const list of data.playlists){
  const block=document.createElement('div');block.className='org-list';
  const h=document.createElement('strong');h.textContent=list.name+' ('+list.items.length+')';block.append(h);
  const actions=document.createElement('div');actions.className='org-actions';
  actions.append(btn('إضافة الرابط الحالي',()=>{
   const id=currentId();if(!validId(id))return notice('ضع رابط يوتيوب صالحًا في البحث.',true);
   if(!list.items.includes(id)&&list.items.length<LIMIT){list.items.push(id);changed('أُضيف المقطع إلى القائمة.')}
  }));
  actions.append(btn('حذف القائمة',()=>{if(confirm('حذف القائمة؟')){data.playlists=data.playlists.filter(x=>x.id!==list.id);changed('حُذفت القائمة.')}}));
  block.append(actions);
  for(const id of list.items)addRow(block,'فيديو '+id,'قائمة '+list.name,()=>play(id),()=>{list.items=list.items.filter(x=>x!==id);changed('حُذف المقطع من القائمة.')});
  p.append(block);
 }
 if(!data.clips.length)c.textContent='لم تُحدد أجزاء زمنية بعد.';
 for(const clip of data.clips){
  let date='';
  if(clip.remindAt)date=' • تذكير: '+new Date(clip.remindAt).toLocaleString('ar-SA');
  addRow(c,clip.title||'مقطع محفوظ',hhmm(clip.start)+' – '+hhmm(clip.end)+date,
   ()=>play(clip.videoId,clip.start,clip.end),()=>{data.clips=data.clips.filter(x=>x.id!==clip.id);changed('حُذف الجزء المحدد.')});
 }
}
$('organizerFavoriteAdd').onclick=()=>{
 const id=currentId();if(!validId(id))return notice('ألصق رابط يوتيوب صالحًا أولًا.',true);
 if(data.favorites.some(x=>x.videoId===id))return notice('الفيديو موجود مسبقًا.');
 if(data.favorites.length>=LIMIT)return notice('وصلت للحد الأقصى للمفضلة.',true);
 const title=$('organizerTitle').value.trim().slice(0,120)||'فيديو '+id;
 data.favorites.unshift({videoId:id,title});changed('أُضيف إلى المفضلة.');
};
$('organizerNewPlaylist').onclick=()=>{
 const name=$('organizerPlaylistName').value.trim().slice(0,80);
 if(!name)return notice('أدخل اسم القائمة.',true);
 if(data.playlists.length>=50)return notice('الحد الأقصى 50 قائمة.',true);
 data.playlists.unshift({id:uid(),name,items:[]});
 $('organizerPlaylistName').value='';changed('أُنشئت قائمة التشغيل.');
};
$('organizerClipForm').onsubmit=e=>{
 e.preventDefault();
 const id=currentId(),start=seconds($('organizerStart').value),end=seconds($('organizerEnd').value);
 if(!validId(id))return notice('ألصق رابط الفيديو في البحث أولًا.',true);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>43200||end-start>7200)return notice('أدخل وقت بداية ونهاية صحيحين؛ الحد الأقصى ساعتان للجزء.',true);
 const localTime=$('organizerRemind').value;
 const remindAt=localTime?new Date(localTime).toISOString():null;
 if(data.clips.length>=LIMIT)return notice('وصلت إلى الحد الأقصى للأجزاء.',true);
 data.clips.unshift({id:uid(),videoId:id,title:$('organizerClipTitle').value.trim().slice(0,100),start,end,remindAt});
 e.target.reset();changed('حُفظ الجزء والموعد. التذكير يظهر عند فتح رَجْع في موعده، وليس إشعارًا بالخلفية.');
};
function checkReminders(){
 if(!scope)return;
 const now=Date.now();
 for(const clip of data.clips){
  if(!clip.remindAt)continue;
  const due=Date.parse(clip.remindAt);
  if(due<=now&&now-due<5*60000){
   const key='raja-reminder-'+clip.id+'-'+clip.remindAt;
   if(sessionStorage.getItem(key))continue;
   sessionStorage.setItem(key,'1');
   notice('حان موعد '+(clip.title||'المقطع')+'؛ افتح قسم القوائم واضغط تشغيل.');
  }
 }
}
window.rajaOrganizerPlay=play;
window.addEventListener('focus',checkReminders);
reminderTimer=setInterval(checkReminders,60000);
bootstrap().then(checkReminders).catch(()=>notice('تعذر فتح المنظم.',true));
})();
