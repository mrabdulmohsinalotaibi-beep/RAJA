import assert from 'node:assert/strict';
const base='https://raja.athat.app';
let ready=false;
for(let n=0;n<12;n++){try{const r=await fetch(base+'/admin/',{cache:'no-store',signal:AbortSignal.timeout(15000)});const text=await r.text();if(r.ok&&text.includes('/admin/admin.js?v=30')){assert.match(r.headers.get('cache-control')||'',/no-store/);ready=true;break}}catch{}await new Promise(r=>setTimeout(r,5000))}
assert.equal(ready,true,'deployed admin shell must be available');
for(const path of ['overview','users','admins','audit']){const r=await fetch(base+'/api/admin/'+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,401,path+' must reject anonymous requests');assert.match(r.headers.get('cache-control')||'',/no-store/)}
const r=await fetch(base+'/api/admin/session',{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,authenticated:false,admin:null});
const s=await fetch(base+'/api/site-config',{signal:AbortSignal.timeout(15000)});assert.equal(s.status,200);assert.equal(typeof(await s.json()).registrationOpen,'boolean');
console.log('PASS live admin routing, private endpoint authentication, session and public settings; no account login/activation or production changes made');
