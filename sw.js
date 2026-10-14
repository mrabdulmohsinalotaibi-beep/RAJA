/* RAJA app shell only. User media and API streaming are never cached by service worker. */
const CACHE='raja-shell-v15';
const SHELL=['/','/index.html','/manifest.webmanifest?v=15','/icon.svg?v=15','/assets/raja-logo.jpeg?v=15','/library.js?v=15','/format-picker.js?v=15','/app-shell.js?v=15','/auth-client.js?v=15','/password-client.js?v=15','/organizer.js?v=15','/lesson-core.js?v=15','/lessons.js?v=15','/sync-core.js?v=15','/cloud-sync.js?v=15','/recorder.js?v=15','/recorder.css?v=15'];
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