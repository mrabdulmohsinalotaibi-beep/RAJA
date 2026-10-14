/* RAJA mobile-first shell and local download-request history.
   Browsers cannot confirm completion of files managed by Safari/Chrome downloads. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const historyKey = () => {
    const auth=window.rajaAuthState?.();
    return auth?.configured && auth.user?.id
      ? 'raja-download-requests-v1-'+String(auth.user.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)
      : auth?.configured ? 'raja-download-requests-v1-locked' : 'raja-download-requests-v1';
  };
  const PANELS = ['search', 'downloads', 'files', 'organizer', 'settings'];
  let currentTab = 'search';

  function storedHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(historyKey()) || '[]');
      return Array.isArray(value) ? value.slice(0, 75) : [];
    } catch { return []; }
  }
  function setHistory(items) {
    try { localStorage.setItem(historyKey(), JSON.stringify(items.slice(0, 75))); }
    catch { /* Storage may be disabled. */ }
  }
  function switchTab(name) {
    const tab = PANELS.includes(name) ? name : 'search';
    currentTab = tab;
    $('recorderScreen').hidden=true;$('managementScreen').hidden=false;
    document.querySelector('main').classList.add('is-managing');
    $('recorderMenu').hidden=true;$('recorderBack').hidden=false;
    for (const node of document.querySelectorAll('[data-tab-panel]')) node.hidden = node.dataset.tabPanel !== tab;
    for (const button of document.querySelectorAll('[data-tab-button]')) {
      const on = button.dataset.tabButton === tab;
      button.classList.toggle('active', on);
      button.setAttribute('aria-current', on ? 'page' : 'false');
    }
    if (tab === 'downloads') drawHistory();
    $('manageContent').scrollTop=0;
  }
  for (const b of document.querySelectorAll('[data-tab-button]')) b.addEventListener('click', () => switchTab(b.dataset.tabButton));

  function readableLabel(entry) {
    if(entry.format) return entry.format + (entry.quality ? ' • ' + entry.quality + (entry.format === 'MP3' ? ' kbps' : 'p') : '');
    return 'ملف وسائط';
  }
  function drawHistory() {
    const holder = $('recentDownloads');
    if (!holder) return;
    holder.replaceChildren();
    const list = storedHistory();
    $('recentDownloadsCount').textContent = list.length + ' طلبات سابقة';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'لم ترسل طلب تنزيل بعد. ألصق رابط فيديو في صفحة البحث واختر الصيغة.';
      holder.append(empty);
    }
    for (const item of list) {
      const row = document.createElement('article');
      row.className = 'request-row';
      const detail = document.createElement('div');
      detail.className = 'request-detail';
      const title = document.createElement('strong');
      title.textContent = readableLabel(item);
      const meta = document.createElement('small');
      meta.textContent = 'أُرسل إلى المتصفح • ' + new Date(item.at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
      const source = document.createElement('small');
      source.className = 'request-source';
      source.textContent = item.url;
      detail.append(title,meta,source);
      const again = document.createElement('button');
      again.className = 'quiet-btn';
      again.type = 'button';
      again.textContent = 'إعادة المحاولة';
      again.onclick = () => {
        $('url').value = item.url;
        switchTab('search');
        $('check').click();
      };
      row.append(detail,again);
      holder.append(row);
    }
  }
  function logDownload() {
    const b = $('formatDownload');
    if (!b || b.getAttribute('aria-disabled') === 'true' || !b.getAttribute('href')) return;
    const link = $('url').value.trim();
    if (!link) return;
    const chosen = document.querySelector('#formatButtons .chosen');
    const label = chosen?.textContent || b.textContent || 'تنزيل';
    const format = (b.textContent.match(/MP4|MP3|M4A|WEBM|OGG|OPUS|WAV|MOV|FLAC|AAC/i) || [null])[0];
    const quality = (label.match(/\b(144|240|360|480|720|1080|192)\b/) || [null])[0];
    const entries = storedHistory();
    entries.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2), url: link, format, quality, at: Date.now() });
    setHistory(entries);
  }
  $('formatDownload')?.addEventListener('click', logDownload, { capture: true });
  $('clearDownloads')?.addEventListener('click', () => {
    if (!confirm('مسح سجل طلبات التنزيل من هذا الجهاز؟ لا تُحذف الملفات الموجودة في تطبيق الملفات.')) return;
    setHistory([]);
    drawHistory();
  });
  $('pasteLink')?.addEventListener('click', async () => {
    const message = $('pasteStatus');
    try {
      if (!navigator.clipboard?.readText) throw Error('unsupported');
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) { message.textContent='الحافظة فارغة.';return; }
      $('url').value = value;
      $('url').dispatchEvent(new Event('input', { bubbles: true }));
      message.textContent = 'تم لصق الرابط. اضغط «عرض الصيغ» لاستكمال التنزيل.';
      $('check').click();
    } catch {
      message.textContent = 'لا يسمح المتصفح بقراءة الحافظة مباشرة. اضغط داخل الحقل واختر «لصق».';
      $('url').focus();
    }
  });
  $('browseMedia')?.addEventListener('click', () => {
    const raw = $('url').value.trim();
    const id = window.rajaYoutubeId?.(raw);
    if (!raw) {
      $('pasteStatus').textContent = 'ألصق رابط فيديو أو ملف وسائط أولًا، ثم اضغط زر المتصفح لمشاهدته.';
      $('url').focus();
      return;
    }
    if (id) {
      window.rajaShowPlayer?.();
      window.rajaOpenYoutube?.(id);
      $('playerDetails')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      $('check').click();
      $('pasteStatus').textContent = 'يمكن فتح رابط ملف الوسائط بعد التعرف على صيغته.';
    }
  });
  $('url')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); $('check').click(); }
  });
  window.rajaSwitchTab = switchTab;
  window.rajaShowPlayer = () => {
    switchTab('search');
    const details = $('playerDetails');
    if (details) details.open = true;
  };
  const params = new URLSearchParams(location.search);
  const rawShare = params.get('url') || params.get('text') || '';
  // Sharing from YouTube often includes descriptive text before the actual URL.
  const match = rawShare.length < 2400 && rawShare.match(/https?:\/\/[^\s<>"']+/i);
  const shared = match ? match[0].replace(/[),؛،.]+$/g, '') : '';
  if (shared && shared.length < 1200) {
    $('url').value = shared;
    $('url').dispatchEvent(new Event('input', { bubbles: true }));
    $('pasteStatus').textContent = 'تم استلام الرابط المُشارك. اختر الصيغة لتنزيله.';
    setTimeout(() => $('check')?.click(), 250);
  }
  if(shared)switchTab('search');else{
    $('recorderScreen').hidden=false;$('managementScreen').hidden=true;
    document.querySelector('main').classList.remove('is-managing');
  }
})();