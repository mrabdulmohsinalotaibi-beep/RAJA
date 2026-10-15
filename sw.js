/* RAJA app shell only. User media and API streaming are never cached by service worker. */
const CACHE='raja-shell-v30';
const SHELL=['/','/index.html','/manifest.webmanifest?v=30','/icon.svg?v=30','/assets/raja-logo.jpeg?v=30','/site-config.js?v=30','/file-fingerprint.js?v=30','/library.js?v=30','/format-picker.js?v=30','/app-shell.js?v=30','/auth-client.js?v=30','/password-client.js?v=30','/organizer.js?v=30','/lesson-core.js?v=30','/lessons.js?v=30','/recorder.js?v=30','/recorder.css?v=30'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||request.method!=='GET'||url.pathname.startsWith('/api/'))return;
  if(!SHELL.some(path=>new URL(path,self.location.origin).pathname===url.pathname))return;
  event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
    if(response.ok&&response.type==='basic'){
      const clone=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)));
    }
    return response;
  }).catch(()=>caches.match(request)));
});