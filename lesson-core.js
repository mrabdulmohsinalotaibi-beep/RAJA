/* Daily lesson windows use Riyadh wall time, independent of the device timezone. */
(function(root){
'use strict';
function dayKey(now=Date.now(),start='05:00'){
 const [h,m]=start.split(':').map(Number);
 const shifted=new Date(Number(now)+3*3600000-(h*60+m)*60000);
 return shifted.toISOString().slice(0,10);
}
const first=list=>({id:list.items[0]?.id||null,offset:0});
function ensureDay(list,now=Date.now()){
 const key=dayKey(now,list.start);
 if(list.day?.key===key)return list.day;
 const cursor=list.cursor&&list.items.some(x=>x.id===list.cursor.id)?list.cursor:first(list);
 list.day={key,start:{...cursor},furthest:0,next:{...cursor},minutes:list.minutes};
 return list.day;
}
function remember(list,elapsed,cursor){
 if(elapsed>list.day.furthest){
  list.day.furthest=elapsed;
  list.day.next={...cursor};
  list.cursor={...cursor};
 }
}
function parts(items,minutes){
 const size=Number(minutes)*60;if(!Number.isFinite(size)||size<=0)throw Error('مدة الجزء غير صالحة.');
 let total=0;const sources=items.map(item=>{const duration=Number(item.duration);if(!Number.isFinite(duration)||duration<=0)throw Error('تحتاج مدة كل ملف لتجهيز الأجزاء.');const source={id:item.id,start:total,end:total+duration,duration};total+=duration;return source});
 return {sources,total,size,count:Math.ceil(Math.max(0,total-.000001)/size),key:JSON.stringify([size,sources.map(s=>[s.id,s.duration])])};
}
function partBounds(plan,index){const i=Math.max(0,Math.min(plan.count-1,Math.floor(index)||0));return {index:i,start:i*plan.size,end:Math.min(plan.total,(i+1)*plan.size),duration:Math.min(plan.size,plan.total-i*plan.size)}}
function absolute(plan,id,offset){const source=plan.sources.find(s=>s.id===id);return source?source.start+Math.max(0,Math.min(source.duration,Number(offset)||0)):0}
function partIndex(plan,value,preferred=null){
 const n=Math.max(0,Math.min(plan.total,Number(value)||0));
 if(Number.isInteger(preferred)&&preferred>=0&&preferred<plan.count){const b=partBounds(plan,preferred);if(n>=b.start-.001&&n<=b.end+.001)return preferred}
 return Math.max(0,Math.min(plan.count-1,Math.floor((n+.000001)/plan.size)));
}
function sourceAt(plan,value){const n=Math.max(0,Math.min(plan.total,Number(value)||0));const source=plan.sources.find(s=>n<s.end-.000001)||plan.sources.at(-1);return source?{id:source.id,offset:Math.max(0,Math.min(source.duration,n-source.start))}:null}
const api={dayKey,ensureDay,remember,first,parts,partBounds,absolute,partIndex,sourceAt};
if(typeof module!=='undefined')module.exports=api;else root.RajaLessons=api;
})(typeof window!=='undefined'?window:globalThis);
