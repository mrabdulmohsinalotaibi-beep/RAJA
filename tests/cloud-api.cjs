const assert=require('node:assert/strict'),{setup,session}=require('./cloud-test-utils.cjs');
(async()=>{
 const {db,env,objects,uploads}=setup(),a=await session(env,'user-a-12345'),b=await session(env,'user-b-12345');
 const file=await import('../functions/api/cloud-file.js'),sync=await import('../functions/api/sync.js');
 async function req(handler,cookie=a,body,query='',method='POST',origin='https://raja.athat.app'){
  const bytes=body instanceof Uint8Array;return handler({env,request:new Request('https://raja.athat.app/api/test'+query,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':bytes?'application/octet-stream':'application/json'},body:body===undefined?undefined:bytes?body:JSON.stringify(body)})});
 }
 assert.equal((await req(sync.onRequestGet,'',undefined,'','GET')).status,401);
 assert.equal((await req(sync.onRequestPut,a,{version:0,data:{lessons:[],links:[]}},'','PUT','https://evil.example')).status,403);
 let r=await req(sync.onRequestGet,a,undefined,'','GET');assert.equal((await r.json()).version,0);
 const list={id:'lessons-12345',name:'Demo',minutes:1,start:'05:00',items:[],day:null,cursor:null};
 r=await req(sync.onRequestPut,a,{version:0,data:{lessons:[list],links:[]}},'','PUT');assert.equal(r.status,200);
 r=await req(sync.onRequestPut,a,{version:0,data:{lessons:[],links:[]}},'','PUT');assert.equal(r.status,409);assert.equal((await r.json()).data.lessons.length,1);
 r=await req(sync.onRequestGet,b,undefined,'','GET');assert.equal((await r.json()).data.lessons.length,0);
 const id='file-12345678',bytes=new Uint8Array(8*1024*1024+13);bytes.fill(27);
 const init={action:'init',id,name:'audio.mp3',size:bytes.length,at:Date.now()};
 assert.equal((await req(file.onRequestPost,a,init)).status,200);
 assert.equal((await req(file.onRequestPost,a,{action:'complete',id})).status,409);
 assert.equal((await req(file.onRequestPut,b,bytes.subarray(0,8*1024*1024),'?id='+id+'&part=1','PUT')).status,409);
 assert.equal((await req(file.onRequestPut,a,new Uint8Array(1),'?id='+id+'&part=1','PUT')).status,422);
 assert.equal((await req(file.onRequestPut,a,bytes.subarray(0,8*1024*1024),'?id='+id+'&part=1','PUT')).status,200);
 r=await req(file.onRequestPost,a,init);assert.deepEqual((await r.json()).parts,[1]);
 assert.equal((await req(file.onRequestPut,a,bytes.subarray(8*1024*1024),'?id='+id+'&part=2','PUT')).status,200);
 assert.equal((await req(file.onRequestPost,a,{action:'complete',id})).status,200);assert.equal(uploads.size,0);assert.equal(objects.size,1);
 assert.equal((await req(file.onRequestGet,b,undefined,'?id='+id,'GET')).status,404);
 r=await file.onRequestGet({env,request:new Request('https://raja.athat.app/api/cloud-file?id='+id,{headers:{Cookie:a,Range:'bytes=5-19'}})});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,15);assert.equal(r.headers.get('Content-Range'),'bytes 5-19/'+bytes.length);
 r=await file.onRequestGet({env,request:new Request('https://raja.athat.app/api/cloud-file?id='+id,{headers:{Cookie:a,Range:'bytes=-7'}})});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,7);
 assert.equal((await req(file.onRequestDelete,a,undefined,'?id='+id,'DELETE')).status,200);assert.equal(objects.size,0);
 assert.equal((await req(file.onRequestPost,a,init)).status,410);
 r=await req(sync.onRequestGet,a,undefined,'','GET');assert.equal((await r.json()).files[0].status,'deleted');
 assert.equal((await req(file.onRequestPost,a,{...init,id:'large-12345678',size:401*1048576})).status,400);
 // Reserve quota atomically without uploading gigabytes.
 for(let n=0;n<2;n++)assert.equal((await req(file.onRequestPost,a,{...init,id:'quota-file-'+n,size:400*1048576})).status,200);
 assert.equal((await req(file.onRequestPost,a,{...init,id:'quota-file-3',size:400*1048576})).status,507);
 db.close();console.log('PASS real SQLite auth isolation, CSRF, version conflicts, resumable multipart upload, length validation, byte ranges, deletion tombstones and atomic storage quota');
})().catch(e=>{console.error(e);process.exitCode=1});
