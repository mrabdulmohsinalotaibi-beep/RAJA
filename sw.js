/* RAJA app shell only. User media and API streaming are never cached by service worker. */
const CACHE='raja-shell-v2';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/library.js','/format-picker.js'];
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
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok&&response.type==='basic'){
      const clone=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)));
    }
    return response;
  }).catch(()=>caches.match(request)));
});