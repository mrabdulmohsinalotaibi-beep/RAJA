/* Compact fixed player; management alone scrolls. No media is restarted by navigation. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),num=new Intl.NumberFormat('ar-SA',{useGrouping:false});
const format=n=>{n=Math.max(0,Math.floor(Number(n)||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
function home(){
 $('recorderScreen').hidden=false;$('managementScreen').hidden=true;
 document.querySelector('main').classList.remove('is-managing');
 $('recorderMenu').hidden=false;$('recorderBack').hidden=true;
}
window.rajaRecorderHome=home;
$('recorderMenu').onclick=()=>window.rajaSwitchTab('organizer');$('recorderBack').onclick=home;
$('recorderPlay').onclick=()=>void window.rajaLessons?.toggle();
$('recorderReplay').onclick=()=>void window.rajaLessons?.replay();
$('recorderBack10').onclick=()=>window.rajaLessons?.seekBy(-10);
$('recorderForward10').onclick=()=>window.rajaLessons?.seekBy(10);
$('recorderPrevious').onclick=()=>void window.rajaLessons?.step(-1);
$('recorderNext').onclick=()=>void window.rajaLessons?.step(1);
$('recorderSeek').oninput=e=>window.rajaLessons?.seek(Number(e.target.value));
let wasPlaying=null;
function refresh(){
 const state=window.rajaLessons?.state()||{name:'كل صوتٍ له رَجْع',title:'ابدأ رحلة الاستماع',index:0,count:0,minutes:30,start:'05:00',position:0,duration:0,elapsed:0,playing:false,picture:false,active:false,done:false};
 if(state){
  $('recorderList').textContent=state.name;$('recorderTitle').textContent=state.title;
  $('recorderSubtitle').textContent=state.done?'اكتملت الحصة · يمكنك إعادتها':state.count?'استماع متسلسل · حصة اليوم':'أضف دروسك من شاشة القوائم';
  $('recorderIndex').textContent=state.count?num.format(state.index)+' من '+num.format(state.count):'مكتبتك اليومية';
  $('recorderDaily').textContent=num.format(state.minutes)+' دقيقة';
  const [h,m]=state.start.split(':').map(Number);$('recorderDayStart').textContent=num.format(h%12||12)+':'+String(m).padStart(2,'0')+(h>=12?' مساءً':' صباحًا');
  $('recorderElapsed').textContent=format(state.elapsed);$('recorderDuration').textContent=format(state.minutes*60);
  $('recorderSeek').max=Number.isFinite(state.duration)&&state.duration>0?state.duration:1;
  $('recorderSeek').value=state.position;$('recorderSeek').disabled=!state.active||state.done;
  $('recorderMedia').classList.toggle('has-picture',state.picture);
  document.querySelector('main').classList.toggle('recorder-playing',state.playing);
  if(wasPlaying!==state.playing){
   wasPlaying=state.playing;
   $('recorderPlay').setAttribute('aria-label',state.playing?'إيقاف مؤقت':'تشغيل');
   const svg=$('recorderPlay').querySelector('svg');svg.replaceChildren();
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d',state.playing?'M8 4v16M16 4v16':'m8 4 12 8-12 8Z');svg.append(path);
  }
 }
 const lessonStatus=$('lessonStatus').textContent;
 $('recorderMessage').textContent=lessonStatus&&state?.active?lessonStatus:'';
}
setInterval(refresh,300);refresh();
$('copyrightYear').textContent=num.format(new Date().getFullYear());
const legal={
 privacy:{title:'الخصوصية',paragraphs:[
 'ملفاتك الصوتية والفيديو وقوائم الدروس والتقدم محفوظة على هذا المتصفح والجهاز. حذف بيانات المتصفح قد يزيلها؛ احتفظ بنسخة من الملفات الأصلية.',
 'عند تفعيل تسجيل الدخول، نستخدم البريد الإلكتروني أو الجوال للتحقق من الحساب. لا نطلب كلمة مرور بريدك. تعالج خدمة التحقق جهة الاتصال والرمز لإتمام الدخول.',
 'تستخدم جلسة الحساب ملفات ارتباط آمنة. قد تُحفظ مفضلة YouTube وقوائمه في حسابك عند تفعيل مزامنتها؛ ملفات الوسائط نفسها لا تتزامن.',
 'عند إضافة رابط خارجي أو تشغيل YouTube، يتصل الجهاز بمصدر المحتوى وتطبق سياسة ذلك المصدر. تجهيز التنزيل قد يمر بخادم معالجة مؤقت.'
 ]},
 terms:{title:'شروط الاستخدام',paragraphs:[
 'رَجْع أداة لتنظيم الدروس والمقاطع والاستماع إليها. استخدم ملفاتك والمحتوى الذي يسمح صاحبه باستخدامه وتنزيله.',
 'يبقى حق المحتوى لأصحابه. يخص اسم Abdulmo7sin حقوق تصميم التطبيق وتطويره، ولا يعني امتلاك المقاطع المضافة.',
 'يتوقف توفر تشغيل أو تنزيل رابط خارجي على المصدر. التشغيل مع قفل الشاشة يعتمد على دعم الجهاز والمتصفح، ويتوقف عند إغلاق التطبيق بالقوة.',
 'بداية اليوم تنظّم الحصة اليومية ولا تشغّل الصوت تلقائيًا. بيانات الدروس محلية؛ احتفظ بنسخة احتياطية من الملفات المهمة.'
 ]}
};
for(const button of document.querySelectorAll('[data-legal]'))button.onclick=()=>{
 const data=legal[button.dataset.legal];$('legalTitle').textContent=data.title;$('legalContent').replaceChildren();
 for(const text of data.paragraphs){const p=document.createElement('p');p.textContent=text;$('legalContent').append(p)}
 $('legalDialog').showModal();
};
$('legalClose').onclick=()=>$('legalDialog').close();
})();
