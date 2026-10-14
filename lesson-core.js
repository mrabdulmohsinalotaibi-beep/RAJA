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
const api={dayKey,ensureDay,remember,first};
if(typeof module!=='undefined')module.exports=api;else root.RajaLessons=api;
})(typeof window!=='undefined'?window:globalThis);
