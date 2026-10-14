/* Controller regression tests without a browser; real media coverage is in lessons-e2e.cjs. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.value='';this.paused=true;this.currentTime=0;this.duration=40;this.dataset={};this.style={};this.listeners={}}
 append(...items){this.children.push(...items)}
 replaceChildren(...items){this.children=items}
 setAttribute(){}
 addEventListener(name,fn){(this.listeners[name]||=[]).push(fn)}
 pause(){this.paused=true;this.onpause?.()}
 play(){this.paused=false;this.onplay?.();return Promise.resolve()}
 load(){if(this.src)queueMicrotask(()=>this.onloadedmetadata?.())}
 removeAttribute(name){delete this[name]}
}
const nodes=new Map(),handlers={},docHandlers={},storage=new Map();
const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
const key='raja-lessons-v1-local';
storage.set(key,JSON.stringify([{id:'list',name:'Lessons',minutes:1,start:'05:00',items:[
 {id:'first',type:'file',libraryId:'f1',title:'first.wav'},
 {id:'second',type:'file',libraryId:'f2',title:'second.wav'}
]}]));
let clock=Date.parse('2026-10-14T03:00:00Z'),writes=0;
class Clock extends Date{static now(){return clock}}
const context={console,Date:Clock,crypto:require('node:crypto').webcrypto,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
 document:{hidden:false,getElementById:get,createElement:tag=>new Element(tag),addEventListener:(n,f)=>docHandlers[n]=f},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{writes++;storage.set(k,v)}},
 navigator:{mediaSession:{setActionHandler(){},setPositionState(){}},audioSession:{}},
 setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,Event:class{},
 confirm:()=>true,prompt:()=>null,queueMicrotask,location:{origin:'https://test.example'},
 dispatchEvent(){},addEventListener:(n,f)=>handlers[n]=f,rajaAuthReady:Promise.resolve({configured:false,user:null}),
 rajaLibrary:{items:async()=>[],getBlob:async()=>({type:''})},
};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../lesson-core.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../lessons.js'),'utf8'),context);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function find(node,text){if(node.textContent===text)return node;for(const c of node.children||[]){const f=find(c,text);if(f)return f}}
const stored=()=>JSON.parse(storage.get(key))[0];
(async()=>{
 await flush();
 await find(get('lessonLists'),'تشغيل حصة اليوم').onclick();await flush();
 const audio=get('lessonAudio');assert.equal(audio.paused,false);assert.equal(audio.currentTime,0);
 context.document.hidden=true;docHandlers.visibilitychange();assert.equal(audio.paused,false);
 audio.currentTime=40;audio.ontimeupdate();await flush();
 assert.match(get('lessonNowTitle').textContent,/second/);
 audio.currentTime=20;audio.ontimeupdate();
 assert.equal(audio.paused,true);assert.equal(stored().day.furthest,60);assert.equal(stored().cursor.id,'second');assert.equal(stored().cursor.offset,20);
 get('lessonReplay').onclick();await flush();assert.equal(audio.currentTime,0);assert.match(get('lessonNowTitle').textContent,/first/);
 audio.currentTime=5;audio.ontimeupdate();assert.equal(stored().cursor.offset,20);
 clock+=86400000;get('lessonReplay').onclick();await flush();assert.equal(audio.currentTime,20);
 assert.equal(stored().day.key,'2026-10-15');assert.equal(stored().day.start.id,'second');
 // A newer tab's storage event must not write stale state back over it.
 const latest=stored();latest.name='Other tab';const incoming=JSON.stringify([latest]);storage.set(key,incoming);const before=writes;
 handlers.storage({key,newValue:incoming});assert.equal(writes,before);assert.equal(storage.get(key),incoming);
 assert.equal(audio.paused,true);
 console.log('PASS controller sequence, cutoff, hidden-page continuity, repeat, rollover, cross-tab preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
