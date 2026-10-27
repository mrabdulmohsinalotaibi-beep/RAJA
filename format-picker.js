/* RAJA YouTube format selector: downloads only actually available media streams. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const picker = $('formatChooser');
  const input = $('url');
  const SUPPORTED = {
    MP4:'فيديو MP4', WEBM:'فيديو WebM', M4A:'صوت M4A',
    MP3:'صوت MP3', OPUS:'صوت OPUS', OGG:'صوت OGG',
    WAV:'صوت WAV', MOV:'فيديو MOV', AAC:'صوت AAC', FLAC:'صوت FLAC',
    MKV:'فيديو MKV', AVI:'فيديو AVI', MPEG:'فيديو MPEG', MPG:'فيديو MPG',
    TS:'فيديو TS', M3U8:'قائمة بث M3U8', MPD:'بيان بث MPD',
    WMA:'صوت WMA', AIFF:'صوت AIFF', AMR:'صوت AMR',
    PDF:'مستند PDF', ZIP:'أرشيف ZIP', RAR:'أرشيف RAR', '7Z':'أرشيف 7Z',
    TXT:'ملف نصي', EPUB:'كتاب EPUB', DOCX:'مستند DOCX', XLSX:'جدول XLSX',
    PPTX:'عرض PPTX', JPG:'صورة JPG', JPEG:'صورة JPEG', PNG:'صورة PNG',
    WEBP:'صورة WebP', GIF:'صورة GIF', SVG:'صورة SVG'
  };
  let current = null, options=[], chosen=null, loading=false, error='', requestSerial=0, timer=null, controller=null;
  const ssFallback=$('ssFallback'), ssFallbackLink=$('ssFallbackLink');
  const ssAutoRedirect=$('ssAutoRedirect');
  const ssCountdown=$('ssCountdown');
  const ssCancel=$('ssCancelRedirect');
  let ssTimer=null;
  function cancelSSRedirect(){
    if(ssTimer!==null){clearTimeout(ssTimer);ssTimer=null}
    ssCountdown.hidden=true;
    ssCancel.hidden=true;
  }
  function offerSSRedirect(serial){
    cancelSSRedirect();
    if(serial!==requestSerial||current?.kind!=='youtube'||!ssAutoRedirect.checked)return;
    let seconds=7;
    const link=ssFallbackLink.href;
    ssCountdown.hidden=false;
    ssCancel.hidden=false;
    const tick=()=>{
      if(serial!==requestSerial||current?.kind!=='youtube'||!ssAutoRedirect.checked){
        cancelSSRedirect();return;
      }
      if(seconds<=0){cancelSSRedirect();window.location.assign(link);return}
      ssCountdown.textContent='لم تتوفر صيغ في رَجْع. ستنتقل إلى خدمة SS الخارجية بعد '+seconds+' ثوانٍ. يمكنك إلغاء الانتقال.';
      seconds--;
      ssTimer=setTimeout(tick,1000);
    };
    tick();
  }
  ssCancel.addEventListener('click',cancelSSRedirect);
  ssAutoRedirect.addEventListener('change',()=>{
    if(!ssAutoRedirect.checked)cancelSSRedirect();
    else if(current?.kind==='youtube' && !!error && !loading)offerSSRedirect(requestSerial);
  });

  function updateSSFallback(){
    const isYoutube=current?.kind==='youtube';
    ssFallback.hidden=!isYoutube;
    if(!isYoutube)return;
    // Construct from the validated 11-character YouTube video identifier only.
    const ssURL=new URL('https://www.ssyoutube.com/watch');
    ssURL.searchParams.set('v',current.id);
    ssFallbackLink.href=ssURL.toString();
    $('ssDescription').textContent=error
      ? 'لم يتمكن رَجْع من توفير الصيغ لهذا الرابط. بإمكانك تجربة خدمة SS الخارجية.'
      : 'يمكنك أيضًا تجربة تحويل رابط يوتيوب إلى طريقة SS الخارجية إذا لم تنجح الخيارات داخل رَجْع.';
  }
  function parse(raw) {
    try {
      const u=new URL(String(raw||'').trim());
      if(!['https:','http:'].includes(u.protocol))return null;
      const id=window.rajaYoutubeId?.(u.href);
      if(id)return {kind:'youtube',id,url:u.href};
      const extension=(u.pathname.match(/\.([a-z0-9]+)$/i)||[])[1]?.toUpperCase();
      if(!SUPPORTED[extension])return null;
      return {kind:'direct',extension,url:u.href};
    }catch{return null}
  }
  function say(text,warn=false){
    const el=$('formatNotice');
    el.textContent=text;
    el.classList.toggle('format-warning',warn);
  }
  function label(stream){
    const t=SUPPORTED[stream.format.toUpperCase()]||stream.format.toUpperCase();
    return t + (stream.quality ? ' — '+stream.quality : '')+(stream.kind==='audio'&&stream.bitrate?' ('+Math.round(stream.bitrate/1000)+' kbps)':'');
  }
  function render(){
    const root=$('formatButtons');
    root.replaceChildren();
    if(!current)return;
    let opts=[];
    if(current.kind==='direct'){
      opts=[{format:current.extension.toLowerCase(),kind:/^(mp3|m4a|ogg|opus|flac|aac|wav|wma|aiff|amr)$/.test(current.extension.toLowerCase())?'audio':/^(mp4|webm|mov|mkv|avi|mpeg|mpg|ts)$/.test(current.extension.toLowerCase())?'video':'file',quality:'',available:true}];
    }else{
      opts=options;
    }
    if(opts.length===0){
      const p=document.createElement('p');
      p.textContent=loading?'جاري البحث عن صيغ قابلة للتنزيل...':error||'لم يتم العثور على أي صيغة متاحة لهذا المقطع.';
      p.className='muted';root.append(p);
    }
    opts.forEach((stream,i)=>{
      const b=document.createElement('button');
      const active=chosen===i;
      b.type='button';b.className='format-option'+(active?' chosen':'');
      b.setAttribute('aria-pressed',String(active));
      const span=document.createElement('span');
      span.textContent=(stream.kind==='audio'?'🎵 ':stream.kind==='video'?'🎬 ':'📄 ')+label(stream);
      const note=document.createElement('small');
      note.textContent=current.kind==='youtube'?(stream.backend?'من خادم رَجْع':'مصدر خارجي غير مضمون على iPhone'):'الملف بصيغته الأصلية';
      b.append(span,note);
      b.onclick=()=>{chosen=i;render();renderAction();};
      root.append(b);
    });
    renderAction();
  }
  function renderAction(){
    updateSSFallback();
    const b=$('formatDownload');
    const selected=current?.kind==='youtube'?options[chosen]:current?.kind==='direct'?[{format:current.extension.toLowerCase()}][chosen]:null;
    const ready=!!selected && !loading;
    b.setAttribute('aria-disabled',String(!ready));
    b.tabIndex=ready?0:-1;
    // Real same-origin attachment link, rather than synthetic hidden-anchor clicks.
    // Allows iOS Safari, desktop browsers and browser download tools to handle saving natively.
    if(!ready){
      b.removeAttribute('href');
      b.removeAttribute('download');
    }else if(current?.kind==='youtube'){
      const q=new URLSearchParams({id:current.id,kind:selected.kind,format:selected.format,quality:selected.quality||''});
      if(selected.localDirect){
        b.href='#';
        b.removeAttribute('download');
      }else{
        b.href='/api/download?'+q.toString();
        b.download='raja-'+current.id+'.'+selected.format;
      }
    }else if(current?.kind==='direct'){
      b.href=current.url;
      b.download=decodeURIComponent(new URL(current.url).pathname.split('/').pop()||'raja-file');
    }
    const keep=$('formatKeep');
    const canSaveVideo=current?.kind==='youtube'&&ready&&selected.backend&&['mp4','mp3'].includes(selected.format);
    keep.disabled=!!(current?.kind==='youtube'&&loading);
    keep.textContent=canSaveVideo?'حفظ الملف داخل ملفاتي':current?.kind==='youtube'?'حفظ رابط المقطع':'حفظ الملف في ملفاتي';
    b.textContent=ready?'تنزيل '+selected.format.toUpperCase()+' إلى جهازي':loading?'جاري فحص الصيغ...':'لا توجد صيغة تنزيل متاحة';
    if(current?.kind==='youtube'){
      if(loading)say('يجري فحص صيغ MP4 والصوت من مصادر مجانية. انتظر النتيجة...');
      else if(error)say(error,true);
      else if(ready)say(selected?.localDirect?'هذه صيغة مكتشفة من مصدر خارجي، وقد يمنع iPhone تنزيلها. سيجري اختبار الاستلام عند الضغط.':'اختر الجودة ثم اضغط تنزيل؛ يعتمد النجاح على توفر الملف وسماح الخادم بالتنزيل.');
      else say('لم تتوفر صيغ قابلة للتنزيل لهذا الرابط.',true);
    }else if(current?.kind==='direct'){
      say('سيُفتح رابط '+current.extension+' الأصلي للتنزيل أو العرض حسب سماح المصدر وإعدادات المتصفح. لا يغيّر رَجْع الصيغة.');
    }
  }
  const BROWSER_MIRRORS=[
    ['piped','https://pipedapi.kavin.rocks'],
    ['piped','https://pipedapi.adminforge.de'],
    ['piped','https://api.piped.private.coffee'],
    ['invidious','https://inv.nadeko.net'],
    ['invidious','https://invidious.nerdvpn.de'],
    ['invidious','https://yt.chocolatemoo53.com']
  ];
  function directStreamUrl(raw){
    try{
      const u=new URL(raw);
      if(u.protocol!=='https:'||u.username||u.password)return null;
      const h=u.hostname.toLowerCase();
      if(!h.endsWith('.googlevideo.com')&&!h.endsWith('.pipedproxy.kavin.rocks')&&!BROWSER_MIRRORS.some(([,base])=>new URL(base).hostname===h))return null;
      return u.href;
    }catch{return null}
  }
  function parseBrowserStreams(json,type){
    const streams=[];
    const add=(raw,kind)=>{
      const url=directStreamUrl(raw.url);
      if(!url)return;
      const mime=String(raw.format||raw.mimeType||raw.type||raw.container||'').toLowerCase();
      const format=mime.includes('m4a')||mime.includes('audio/mp4')?'m4a':mime.includes('mp4')?'mp4':mime.includes('webm')?'webm':mime.includes('opus')?'opus':mime.includes('ogg')?'ogg':'';
      if(!format)return;
      streams.push({format,kind,quality:String(raw.quality||raw.qualityLabel||raw.resolution||'').slice(0,50),bitrate:Number(raw.bitrate)||null,url,localDirect:true});
    };
    if(type==='piped'){
      (json.videoStreams||[]).filter(e=>!e.videoOnly&&e.audioTrack!==false).forEach(e=>add(e,'video'));
      (json.audioStreams||[]).forEach(e=>add(e,'audio'));
    }else{
      (json.formatStreams||[]).forEach(e=>add(e,'video'));
      (json.adaptiveFormats||[]).filter(e=>String(e.type||'').startsWith('audio/')).forEach(e=>add(e,'audio'));
    }
    return streams.slice(0,25);
  }
  async function browserFallback(id,serial){
    // Do not present third-party stream metadata as a successful download.
    // Browser CORS, expired signatures and blocked hosts are common on iOS.
    const attempts=await Promise.all(BROWSER_MIRRORS.map(async ([type,base])=>{
      const ac=new AbortController();
      const timeout=setTimeout(()=>ac.abort(),7000);
      try{
        const response=await fetch(base+(type==='piped'?'/streams/':'/api/v1/videos/')+encodeURIComponent(id),{mode:'cors',credentials:'omit',signal:ac.signal});
        if(!response.ok)return null;
        const data=await response.json();
        const streams=parseBrowserStreams(data,type);
        return streams.length?{streams,title:String(data.title||'').slice(0,140)}:null;
      }catch{return null}
      finally{clearTimeout(timeout)}
    }));
    if(serial!==requestSerial)return false;
    const good=attempts.find(Boolean);
    if(!good)return false;
    // Avoid duplicates when providers repeat the same variants.
    const unique=new Map();
    for(const stream of good.streams)if(!unique.has(stream.url))unique.set(stream.url,stream);
    options=[...unique.values()];
    chosen=0;error='';
    if(good.title)$('formatIntro').textContent=good.title;
    return true;
  }
  async function saveBrowserStream(stream){
    const ac=new AbortController();
    const timeout=setTimeout(()=>ac.abort(),180000);
    const maxSize=300*1024*1024;
    const id=current?.id;
    say('التحقق من إمكانية استلام الملف عبر متصفح الجهاز...');
    try{
      const response=await fetch(stream.url,{mode:'cors',credentials:'omit',signal:ac.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const type=(response.headers.get('content-type')||'').toLowerCase();
      if(type.includes('text/html')||type.includes('application/json'))throw new Error('استجاب المصدر بصفحة وليس ملف وسائط');
      const size=Number(response.headers.get('content-length')||0);
      if(size>maxSize)throw new Error('الملف أكبر من 300 ميجابايت');
      const blob=await response.blob();
      if(!blob.size||blob.size>maxSize)throw new Error('الملف فارغ أو أكبر من الحد المسموح');
      const objectURL=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=objectURL;a.download='raja-'+id+'.'+stream.format;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectURL),60000);
      say('استلم المتصفح الملف؛ تحقق من التنزيلات أو تطبيق الملفات.');
    }catch(e){
      const blocked=e instanceof TypeError;
      say(blocked?'المصدر لا يسمح باستلام الملف من متصفح iPhone (قيود الوصول CORS). عرض الصيغة لا يعني أن رابطها قابل للتنزيل. يمكنك تشغيل المقطع داخل رَجْع أو استيراد ملف حصلت عليه من مصدر مصرح.':'فشل استلام الملف: '+(e.name==='AbortError'?'انتهت المهلة':e.message),true);
    }finally{clearTimeout(timeout)}
  }
  async function checkYoutube(id,serial){
    const ac=new AbortController();
    controller=ac;
    try{
      const r=await fetch('/api/formats?id='+encodeURIComponent(id),{signal:ac.signal,cache:'no-store'});
      const json=await r.json().catch(()=>({}));
      if(serial!==requestSerial||current?.id!==id)return;
      if(r.status===401 || json.error==='google_signin_required'){
        error='سجّل الدخول إلى رَجْع بحساب Google للمتابعة. هذا لا يسجّلك تلقائيًا في YouTube.';
        cancelSSRedirect();
        updateSSFallback();
        return;
      }
      if(!r.ok||!json.ok){
        error='لم تستجب الخدمة السحابية، جاري تجربة اتصال جهازك المباشر بمزودي الخدمة المجانية...';
        render();
        const success=await browserFallback(id,serial);
        if(!success&&serial===requestSerial){
          error='لم تتوفر صيغ تنزيل لهذا الرابط الآن؛ قد يتطلب المقطع تسجيل دخول أو تحققًا من يوتيوب.';
          updateSSFallback();
          offerSSRedirect(serial);
        }
        return;
      }
      options=(Array.isArray(json.streams)?json.streams:[]).filter(s=>s&&
        ['video','audio'].includes(s.kind)&&
        ['mp4','webm','m4a','mp3','opus','ogg'].includes(s.format));
      // Expose only real formats. Never suggest MP3 unless provider actually supplies MP3.
      options=options.slice(0,30).sort((a,b)=>{
        const priority=s=>s.kind==='video'?(s.format==='mp4'?0:1):(s.format==='m4a'?2:3);
        return priority(a)-priority(b)||String(b.quality).localeCompare(String(a.quality),undefined,{numeric:true});
      });
      chosen=options.length?Math.max(0,options.findIndex(s=>s.kind==='video'&&s.format==='mp4'&&String(s.quality)==='720')):null;
      if(!options.length)error='لم يُرجع مزوّد التنزيل أي ملف قابل للحفظ.';
      if(json.title)$('formatIntro').textContent=json.title;
    }catch(e){
      if(e.name!=='AbortError'&&serial===requestSerial){error='جارٍ تجربة اتصال جهازك المباشر بالمصدر المجاني...';render();const success=await browserFallback(id,serial);if(!success&&serial===requestSerial){
          error='تعذر الاتصال بخدمة تنزيل يوتيوب لهذا الرابط. حاول مجددًا لاحقًا.';
          updateSSFallback();
          offerSSRedirect(serial);
        }}
    }finally{
      if(serial===requestSerial){loading=false;render();}
    }
  }
  function resetNetwork(){
    cancelSSRedirect();
    requestSerial++;
    if(controller){controller.abort();controller=null}
    options=[];chosen=null;loading=false;error='';
  }
  function inspect(silent=false,force=false){
    const data=parse(input.value);
    if(!data){
      resetNetwork();current=null;picker.hidden=true;updateSSFallback();
      if(!silent)$('notice').textContent='أدخل رابط YouTube أو رابط ملف مباشر بصيغة مدعومة.';
      return false;
    }
    if(current?.url===data.url&&!force)return true;
    resetNetwork();
    current=data;
    picker.hidden=false;updateSSFallback();
    $('formatSource').textContent=data.kind==='youtube'?'رابط YouTube':'ملف مباشر';
    $('formatIntro').textContent=data.kind==='youtube'?'اكتشاف صيغ الفيديو والصوت المتاحة...':'تنزيل الملف بصيغته الأصلية';
    $('formatPreview').textContent=data.kind==='youtube'?'مشاهدة الفيديو':'فتح الملف';
    const cover=$('formatCover');
    cover.hidden=data.kind!=='youtube';
    if(data.kind==='youtube')cover.src='https://i.ytimg.com/vi/'+encodeURIComponent(data.id)+'/hqdefault.jpg';
    else cover.removeAttribute('src');
    if(data.kind==='youtube'){
      loading=true;
      render();
      checkYoutube(data.id,requestSerial);
    }else{chosen=0;render();}
    return true;
  }
  $('formatDownload').onclick=event=>{
    const b=$('formatDownload');
    if(b.getAttribute('aria-disabled')==='true'||!current||loading){
      event.preventDefault(); return;
    }
    if(current.kind==='youtube'){
      const selected=options[chosen];
      if(!selected){event.preventDefault();return}
      if(selected.localDirect){
        event.preventDefault();
        saveBrowserStream(selected);
      }else{
        say('أرسل رَجْع طلب الملف إلى تنزيلات المتصفح. ستظهر النتيجة في تنزيلات الجهاز؛ وقد يفشل المصدر في بعض المقاطع.');
      }
    }else{
      say('أرسل رَجْع رابط الملف المباشر إلى تنزيلات المتصفح.');
    }
  };
  function watchLink(){
    const data=parse(input.value);
    if(!data){$('notice').textContent='أدخل رابط يوتيوب أو رابط ملف وسائط مباشر صحيح.';return}
    // Playback must not wait for extraction or later redirect to a download site.
    clearTimeout(timer);resetNetwork();current=data;picker.hidden=true;
    window.rajaShowPlayer?.();
    if(data.kind==='youtube')window.rajaOpenYoutube(data.id);
    else if(/^(mp3|m4a|ogg|opus|flac|aac|wav|wma|aiff|amr|mp4|webm|mov|mkv|avi|mpeg|mpg|ts)$/i.test(data.extension))window.rajaLoadMedia(data.url,'وسائط');
    else {window.open(data.url,'_blank','noopener,noreferrer');return;}
    $(data.kind==='youtube'?'youtube':'player').scrollIntoView({behavior:'smooth',block:'center'});
  }
  $('formatPreview').onclick=watchLink;
  $('watchLink').onclick=watchLink;
  $('formatKeep').onclick=async()=>{
    if(!current)return;
    const b=$('formatKeep');
    const selected=current.kind==='youtube'?options[chosen]:null;
    if(selected?.backend&&['mp4','mp3'].includes(selected.format)){
      b.disabled=true;
      const saved=await window.rajaLibrarySaveYouTubeMedia?.({
        videoId:current.id, kind:selected.kind, format:selected.format, quality:selected.quality
      });
      b.disabled=false;
      if(saved)window.rajaSwitchTab?.('files');
      return;
    }
    $('addToLibrary')?.click();
    window.rajaSwitchTab?.('files');
  };
  $('formatClose').onclick=()=>{picker.hidden=true;};
  input.addEventListener('input',()=>{
    clearTimeout(timer);
    if(!input.value.trim()){inspect(true);return}
    timer=setTimeout(()=>inspect(true),550);
  });
  input.addEventListener('change',()=>inspect(true));
  $('check').setAttribute('aria-label','عرض صيغ الفيديو والصوت');
  $('check').title='عرض صيغ الفيديو والصوت';
  $('check').onclick=()=>{
    inspect(false,!picker.hidden&&current?.kind==='youtube'&&!!error);
    if(!picker.hidden)picker.scrollIntoView({behavior:'smooth',block:'center'});
  };
  if(input.value)inspect(true);
})();