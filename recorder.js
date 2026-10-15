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
$('recorderRepeat').onchange=e=>window.rajaLessons?.setRepeat(e.target.value);
$('recorderList').onchange=e=>window.rajaLessons?.selectList(e.target.value);
$('lessonNewList').onclick=()=>{window.rajaSwitchTab('organizer');if($('lessonCreatePanel'))$('lessonCreatePanel').open=true;$('lessonCreate').scrollIntoView({block:'nearest',behavior:'smooth'});$('lessonName').focus()};
let wasPlaying=null,listSignature='';
function refresh(){
 const state=window.rajaLessons?.state()||{name:'كل صوتٍ له رَجْع',title:'ابدأ رحلة الاستماع',index:0,count:0,minutes:30,start:'05:00',position:0,duration:0,elapsed:0,playing:false,picture:false,active:false,done:false};
 if(state){
  const options=window.rajaLessons?.listOptions?.()||[];
  if(state.listId&&!options.some(o=>o.id===state.listId))options.push({id:state.listId,name:state.name});
  const signature=JSON.stringify(options);
  if(signature!==listSignature){listSignature=signature;$('recorderList').replaceChildren();
   for(const item of options.length?options:[{id:'',name:'كل صوتٍ له رَجْع'}]){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;$('recorderList').append(option)}
  }
  $('recorderList').value=state.listId||'';$('recorderList').disabled=options.length<2;
  $('recorderTitle').textContent=state.title;
  $('recorderSubtitle').textContent=state.done?(state.segmented?'اكتمل الجزء · أعده أو انتقل للتالي':'اكتملت القائمة · يمكنك اختيار أي مقطع'):state.resumable?'جاهز للمتابعة · توقفت عند '+format(state.position):state.count?(state.segmented?'الجزء ':'المقطع ')+num.format(state.index)+' من '+num.format(state.count)+' · '+(state.playing?'تستمع الآن':'توقفت عند '+format(state.position)):'أضف دروسك من شاشة القوائم';
  $('recorderRepeat').value=String(state.repeatMode||0);$('recorderRepeat').disabled=!state.segmented;
  if(state.segmented&&state.repeatMode)$('recorderSubtitle').textContent+=' · التكرار '+num.format(state.repeatIteration)+(state.repeatMode===-1?' المستمر':' من '+num.format(state.repeatMode));
  $('recorderIndex').textContent=state.count?(state.segmented?'الجزء ':'المقطع ')+num.format(state.index)+' من '+num.format(state.count):'مكتبتك الصوتية';
  $('recorderMode').textContent=state.segmented?'أجزاء متصلة':'مفتوح · متسلسل';
  $('recorderTargetLabel').textContent=state.segmented?'مدة الجزء':'الهدف اليومي';$('recorderTimeLabel').textContent=state.segmented?'مدة القائمة':'تجدد الإحصاء';
  $('recorderDaily').textContent=state.segmented?num.format(state.partMinutes)+' دقيقة':state.minutes?num.format(state.minutes)+' دقيقة':'استماع مفتوح';
  $('recorderPlay').disabled=!!state.preparing;
  $('recorderPlayLabel').textContent=state.preparing?'جارٍ تجهيز الأجزاء...':state.playing?'إيقاف مؤقت':state.done?(state.segmented?'إعادة الجزء':'إعادة المقطع'):state.position>0?'كمّل من حيث توقفت':'ابدأ الاستماع';
  $('recorderGoal').hidden=!state.minutes;
  $('recorderGoalText').textContent=state.goalReached?'أكملت هدف اليوم ✓ · واصل بحرية':'هدف اليوم · '+format(state.elapsed)+' / '+format(state.minutes*60);
  $('recorderGoalProgress').value=state.minutes?Math.min(100,state.elapsed/(state.minutes*60)*100):0;
  const [h,m]=state.start.split(':').map(Number);$('recorderDayStart').textContent='\u2066'+num.format(h%12||12)+':'+num.format(m).padStart(2,'٠')+'\u2069'+(h>=12?' مساءً':' صباحًا');
  if(state.segmented)$('recorderDayStart').textContent=format(state.totalDuration);
  $('recorderPrevious').setAttribute('aria-label',state.segmented?'الجزء السابق':'المقطع السابق');$('recorderNext').setAttribute('aria-label',state.segmented?'الجزء التالي':'المقطع التالي');
  $('recorderReplayLabel').textContent=state.segmented?'إعادة الجزء':'إعادة المقطع';
  $('recorderElapsed').textContent=format(state.position);$('recorderDuration').textContent=format(state.duration);
  $('recorderSeek').max=Number.isFinite(state.duration)&&state.duration>0?state.duration:1;
  $('recorderSeek').value=state.position;$('recorderSeek').style.setProperty('--progress',Math.min(100,Math.max(0,state.position/Number($('recorderSeek').max)*100))+'%');$('recorderSeek').disabled=!state.active;
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
 $('recorderMessage').textContent=lessonStatus&&(state?.active||state?.preparing)?lessonStatus:'';
}
setInterval(refresh,300);refresh();
$('copyrightYear').textContent=num.format(new Date().getFullYear());
const legal={
 privacy:{title:'الخصوصية',paragraphs:[
 'تُحفظ ملفاتك وقوائمك ومواضع استماعك على هذا الجهاز فقط، ولا تُرفع تلقائيًا ولا تتزامن مع الأجهزة الأخرى. احتفظ بنسخة مستقلة من ملفاتك المهمة.',
 'يمكن إنشاء حساب رَجْع بالجوال أو البريد وكلمة مرور خاصة بالتطبيق. لا نطلب كلمة مرور صندوق بريدك، ولا نتحقق من ملكية الجوال أو البريد برسالة حاليًا. كلمات المرور تُحفظ كبصمات مشتقة وليست نصًا مقروءًا.',
 'تستخدم جلسة الحساب ملفات ارتباط آمنة. تحفظ بيانات الحساب وبصمات كلمة المرور ورمز الاستعادة في قاعدة بيانات رَجْع.  تُحفظ مفضلة YouTube وقوائمه على هذا الجهاز فقط.',
 'عند إضافة رابط خارجي أو تشغيل YouTube، يتصل الجهاز بمصدر المحتوى وتطبق سياسة ذلك المصدر. تجهيز التنزيل قد يمر بخادم معالجة مؤقت.'
 ]},
 terms:{title:'شروط الاستخدام',paragraphs:[
 'رَجْع أداة لتنظيم الدروس والمقاطع والاستماع إليها. استخدم ملفاتك والمحتوى الذي يسمح صاحبه باستخدامه وتنزيله.',
 'يبقى حق المحتوى لأصحابه. يخص اسم Abdulmo7sin حقوق تصميم التطبيق وتطويره، ولا يعني امتلاك المقاطع المضافة.',
 'يتوقف توفر تشغيل أو تنزيل رابط خارجي على المصدر. التشغيل مع قفل الشاشة يعتمد على دعم الجهاز والمتصفح، ويتوقف عند إغلاق التطبيق بالقوة.',
 'بداية اليوم تنظّم عدّاد الهدف الاختياري ولا تشغّل الصوت تلقائيًا. بيانات الدروس محلية؛ احتفظ بنسخة احتياطية من الملفات المهمة.'
 ]}
};
for(const button of document.querySelectorAll('[data-legal]'))button.onclick=()=>{
 const data=legal[button.dataset.legal];$('legalTitle').textContent=data.title;$('legalContent').replaceChildren();
 for(const text of data.paragraphs){const p=document.createElement('p');p.textContent=text;$('legalContent').append(p)}
 $('legalDialog').showModal();
};
$('legalClose').onclick=()=>$('legalDialog').close();
})();
