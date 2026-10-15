/* Full-content fingerprint with bounded-memory, fixed-size SHA-256 chunks. */
(function(root){
 'use strict';
 async function fingerprint(blob,onProgress){
  const chunk=1024*1024,leaves=[],subtle=root.crypto?.subtle;if(!subtle)throw Error('فحص التكرار يحتاج اتصال HTTPS ومتصفحًا يدعم التشفير.');
  for(let offset=0;offset<blob.size;offset+=chunk){leaves.push(new Uint8Array(await subtle.digest('SHA-256',await blob.slice(offset,offset+chunk).arrayBuffer())));onProgress?.(Math.min(blob.size,offset+chunk),blob.size)}
  const head=new TextEncoder().encode('raja-content-v1:'+blob.size+':'+chunk+':'),data=new Uint8Array(head.length+leaves.length*32);data.set(head);leaves.forEach((leaf,i)=>data.set(leaf,head.length+i*32));
  const digest=new Uint8Array(await subtle.digest('SHA-256',data));return 'raja-content-v1:'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 }
 if(typeof module!=='undefined')module.exports=fingerprint;else root.rajaFileFingerprint=fingerprint;
})(typeof window!=='undefined'?window:globalThis);
