/* RAJA format picker. Never claim YouTube downloads are supported without a real backend. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pick = $('formatChooser');
  const paste = $('url');
  const types = [
    {ext:'MP4', name:'فيديو MP4', detail:'فيديو مع الصوت', icon:'🎬'},
    {ext:'MP3', name:'صوت MP3', detail:'صوت فقط', icon:'🎵'},
    {ext:'WEBM', name:'فيديو WebM', detail:'فيديو بصيغته الأصلية', icon:'📹'},
    {ext:'M4A', name:'صوت M4A', detail:'صيغة صوتية', icon:'🎧'},
    {ext:'WAV', name:'صوت WAV', detail:'صوت غير مضغوط', icon:'🔉'},
    {ext:'OGG', name:'صوت OGG', detail:'صيغة صوتية', icon:'🎶'},
    {ext:'MOV', name:'فيديو MOV', detail:'صيغة فيديو', icon:'📽️'},
    {ext:'AAC', name:'صوت AAC', detail:'صيغة صوتية', icon:'🔊'},
    {ext:'FLAC', name:'صوت FLAC', detail:'صوت بجودة عالية', icon:'🎼'}
  ];
  const extPattern = /\.(mp4|mp3|webm|m4a|wav|ogg|mov|aac|flac)(?:$|[?#])/i;
  let current, selected = 'MP4';
  function parse(raw) {
    try {
      const url = new URL(raw.trim());
      if(!['https:', 'http:'].includes(url.protocol)) return null;
      const yt = window.rajaYoutubeId?.(raw);
      if(yt) return {kind:'youtube', id:yt, url:url.href};
      const m = url.pathname.match(/\.([a-z0-9]+)$/i);
      const extension = m?.[1]?.toUpperCase();
      if(!types.some(t=>t.ext===extension)) return null;
      return {kind:'direct', extension, url:url.href};
    } catch { return null; }
  }
  function setMessage(message, warn=false) {
    $('formatNotice').textContent=message;
    $('formatNotice').classList.toggle('format-warning',warn);
  }
  function drawOptions(){
    const root = $('formatButtons');
    root.replaceChildren();
    const options = current.kind === 'youtube' ? types.slice(0,4)
      : [types.find(t=>t.ext===current.extension), ...types.filter(t=>t.ext!==current.extension).slice(0,3)];
    for(const t of options) {
      const available = current.kind === 'direct' && t.ext === current.extension;
      const b=document.createElement('button');
      b.type='button';
      b.className='format-option'+(selected===t.ext?' chosen':'');
      b.setAttribute('aria-pressed', String(selected===t.ext));
      const first=document.createElement('span');first.textContent=t.icon+' '+t.name;
      const second=document.createElement('small');
      second.textContent=available?'متاح: الملف الأصلي':current.kind==='youtube'?'يتطلب خدمة تنزيل':'يتطلب تحويل الصيغة';
      b.append(first,second);
      b.onclick=()=>{selected=t.ext;drawOptions();drawAction();};
      root.append(b);
    }
  }
  function drawAction() {
    const ready=current.kind==='direct' && current.extension===selected;
    const b=$('formatDownload');
    b.disabled=!ready;
    b.textContent=ready?'تنزيل '+selected+' إلى الجهاز':'تنزيل '+selected+' (غير متاح بعد)';
    if(current.kind==='youtube'){
      setMessage('تم التعرف على رابط YouTube. اختيار MP4 أو MP3 هو تفضيل للصيغة، لكن لا توجد خدمة استخراج متصلة بالموقع؛ لا يمكن تنزيل الفيديو من هذا الرابط حاليًا.',true);
    } else if(ready) {
      setMessage('يمكن محاولة تنزيل الملف بصيغته '+selected+' دون تحويل. قد يفتح المصدر الملف بدل تنزيله إذا منع الخادم الحفظ المباشر.');
    } else {
      setMessage('التحويل من '+current.extension+' إلى '+selected+' غير متاح حاليًا؛ تستطيع تنزيل الملف بصيغته الأصلية.',true);
    }
  }
  function inspect(silent=false) {
    const data = parse(paste.value);
    if(!data) {
      pick.hidden=true;
      current=null;
      if(!silent) $('notice').textContent='ألصق رابط YouTube صحيحًا أو رابط ملف مباشر بصيغة مدعومة.';
      return false;
    }
    if(current?.url===data.url && !pick.hidden) return true;
    current=data;
    selected=data.kind==='youtube'?'MP4':data.extension;
    pick.hidden=false;
    $('formatSource').textContent=data.kind==='youtube'?'رابط YouTube':'رابط ملف وسائط مباشر';
    $('formatIntro').textContent=data.kind==='youtube'
      ?'اختر الصيغة التي تريدها. التنزيل من YouTube يحتاج إلى خدمة مستقلة غير مفعّلة حاليًا.'
      :'اختر صيغة التنزيل. المتاح الآن هو الملف بصيغته الأصلية، دون تحويل.';
    $('formatPreview').textContent=data.kind==='youtube'?'مشاهدة عبر YouTube':'تشغيل المقطع';
    $('formatCover').hidden=data.kind!=='youtube';
    if(data.kind==='youtube') $('formatCover').src='https://i.ytimg.com/vi/'+encodeURIComponent(data.id)+'/hqdefault.jpg';
    else $('formatCover').removeAttribute('src');
    drawOptions();drawAction();
    return true;
  }
  $('formatDownload').onclick=()=>{
    if(!current || current.kind!=='direct' || selected!==current.extension) return;
    const a=document.createElement('a');
    a.href=current.url;
    a.download=decodeURIComponent(new URL(current.url).pathname.split('/').pop()||'raja-media');
    a.rel='noopener noreferrer';
    document.body.appendChild(a);a.click();a.remove();
    setMessage('تم إرسال رابط الملف إلى المتصفح. يعتمد إكمال الحفظ على سماح الخادم الأصلي بالتنزيل.');
  };
  $('formatPreview').onclick=()=>{
    if(!current) return;
    if(current.kind==='youtube') window.rajaOpenYoutube(current.id);
    else window.rajaLoadMedia(current.url,decodeURIComponent(new URL(current.url).pathname.split('/').pop()||'ملف وسائط'));
    document.getElementById('player').scrollIntoView({behavior:'smooth',block:'center'});
  };
  $('formatKeep').onclick=()=>{
    if(!current)return;
    const b=$('addToLibrary');
    if(b) { b.click(); $('library').scrollIntoView({behavior:'smooth',block:'start'}); }
    else setMessage('تعذر الوصول إلى المكتبة المحلية.',true);
  };
  $('formatClose').onclick=()=>{pick.hidden=true;};
  paste.addEventListener('input',()=>inspect(true));
  paste.addEventListener('change',()=>inspect(true));
  $('check').textContent='عرض خيارات التحميل';
  $('check').onclick=()=>{inspect(); if(!pick.hidden)pick.scrollIntoView({behavior:'smooth',block:'center'});};
  // Support entering a URL with a query string such as youtu.be/ID?si=... .
  if(paste.value) inspect(true);
})();