const assert=require('node:assert/strict');globalThis.crypto||=require('node:crypto').webcrypto;const hash=require('../file-fingerprint.js');
(async()=>{
 const bytes=Buffer.alloc(2*1024*1024+53,7);const a=new Blob([bytes],{type:'audio/mpeg'}),b=new Blob([bytes],{type:'application/octet-stream'});let max=0;const probe={size:a.size,slice(start,end){max=Math.max(max,end-start);return a.slice(start,end)}};
 assert.equal(await hash(a),await hash(b));assert.equal(await hash(probe),await hash(a));assert.ok(max<=1024*1024);
 const changed=Buffer.from(bytes);changed[1024*1024+17]=8;assert.notEqual(await hash(new Blob([changed])),await hash(a));assert.notEqual(await hash(new Blob([bytes.subarray(0,bytes.length-1)])),await hash(a));
 console.log('PASS full-content hash independent of name/MIME, middle-chunk changes, file length and bounded chunk memory');
})().catch(e=>{console.error(e);process.exit(1)});
