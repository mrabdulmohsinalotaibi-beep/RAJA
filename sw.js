/* RAJA app shell only. User media and API streaming are never cached by service worker. */
const CACHE='raja-shell-v24';
const SHELL=['/','/index.html','/manifest.webmanifest?v=24','/icon.svg?v=24','/assets/raja-logo.jpeg?v=24','/library.js?v=24','/format-picker.js?v=24','/app-shell.js?v=24','/auth-client.js?v=24','/password-client.js?v=24','/organizer.js?v=24','/lesson-core.js?v=24','/lessons.js?v=24','/recorder.js?v=24','/recorder.css?v=24'];
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