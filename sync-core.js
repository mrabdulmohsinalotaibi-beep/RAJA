/* Three-way merging: deletion awareness, conflict copies, and monotonic daily progress. */
(function(root){
'use strict';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const shape=l=>l&&({id:l.id,name:l.name,minutes:l.minutes,start:l.start,items:l.items});
const plan=l=>l&&({minutes:l.minutes,start:l.start,items:l.items});
function progress(local,remote,winner=remote){
 const result=clone(winner),a=local.day,b=remote.day;result.day=clone(b);result.cursor=clone(remote.cursor);
 if(!b||(a&&(a.key>b.key||(a.key===b.key&&a.furthest>b.furthest)))){result.day=clone(a);result.cursor=clone(local.cursor)}
 return result;
}
function mergeLists(base,local,remote,makeId){
 const bm=new Map(base.map(x=>[x.id,x])),lm=new Map(local.map(x=>[x.id,x])),rm=new Map(remote.map(x=>[x.id,x])),out=[];
 for(const id of new Set([...remote.map(x=>x.id),...local.map(x=>x.id),...base.map(x=>x.id)])){
  const b=bm.get(id),l=lm.get(id),r=rm.get(id);
  if(equal(l,b)){if(r)out.push(clone(r));continue}
  if(equal(r,b)){if(l)out.push(clone(l));continue}
  if(equal(l,r)){if(l)out.push(clone(l));continue}
  if(!l){if(r)out.push(clone(r));continue}
  if(!r){if(!b)out.push(clone(l));else out.push({...clone(l),id:makeId(),name:l.name.slice(0,120)+' — نسخة محفوظة'});continue}
  if(equal(shape(l),shape(r))){out.push(progress(l,r));continue}
  if(equal(shape(l),shape(b))){out.push(equal(plan(l),plan(r))?progress(l,r):clone(r));continue}
  if(equal(shape(r),shape(b))){out.push(equal(plan(l),plan(r))?progress(l,r,l):clone(l));continue}
  out.push(clone(r),{...clone(l),id:makeId(),name:l.name.slice(0,120)+' — نسخة من الجهاز'});
 }
 return out;
}
function mergeLinks(base,local,remote){
 const bm=new Map(base.map(x=>[x.id,x])),lm=new Map(local.map(x=>[x.id,x])),rm=new Map(remote.map(x=>[x.id,x])),out=[];
 for(const id of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const b=bm.get(id),l=lm.get(id),r=rm.get(id);const value=equal(l,b)?r:equal(r,b)?l:r||l;if(value)out.push(clone(value))}return out;
}
function merge(base,local,remote,makeId=()=>crypto.randomUUID()){
 return {lessons:mergeLists(base.lessons||[],local.lessons||[],remote.lessons||[],makeId),links:mergeLinks(base.links||[],local.links||[],remote.links||[])};
}
const api={merge,equal};if(typeof module!=='undefined')module.exports=api;else root.RajaSyncCore=api;
})(typeof window!=='undefined'?window:globalThis);
