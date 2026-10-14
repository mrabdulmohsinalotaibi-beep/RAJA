/* RAJA app shell only. User media and API streaming are never cached by service worker. */
const CACHE='raja-shell-v18';
const SHELL=['/','/index.html','/manifest.webmanifest?v=18','/icon.svg?v=18','/assets/raja-logo.jpeg?v=18','/library.js?v=18','/format-picker.js?v=18','/app-shell.js?v=18','/auth-client.js?v=18','/password-client.js?v=18','/organizer.js?v=18','/lesson-core.js?v=18','/lessons.js?v=18','/recorder.js?v=18','/recorder.css?v=18'];
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