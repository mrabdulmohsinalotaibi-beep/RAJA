/* RAJA app shell only. User media and API streaming are never cached by service worker. */
const CACHE='raja-shell-v12';
const SHELL=['/','/index.html','/manifest.webmanifest?v=12','/icon.svg?v=12','/assets/raja-logo.jpeg?v=12','/library.js?v=12','/format-picker.js?v=12','/app-shell.js?v=12','/auth-client.js?v=12','/organizer.js?v=12','/lesson-core.js?v=12','/lessons.js?v=12','/recorder.js?v=12','/recorder.css?v=12'];
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