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
const nodes=new Map(),handlers={},docHandlers={},storage=new Map(),sessionActions={},audioTypes=[];
const audioSession={set type(value){this.value=value;audioTypes.push(value)},get type(){return this.value}};
const get=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
const key='raja-lessons-v1-local';
storage.set(key,JSON.stringify([{id:'list',name:'Lessons',partMinutes:0,minutes:1,goalMinutes:1,start:'05:00',items:[
 {id:'first',type:'file',libraryId:'f1',title:'first.wav'},
 {id:'second',type:'file',libraryId:'f2',title:'second.wav'}
]}]));
let clock=Date.parse('2026-10-14T03:00:00Z'),writes=0;
class Clock extends Date{static now(){return clock}}
const context={console,Date:Clock,crypto:require('node:crypto').webcrypto,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
 document:{hidden:false,getElementById:get,createElement:tag=>new Element(tag),addEventListener:(n,f)=>docHandlers[n]=f},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{writes++;storage.set(k,v)}},
 navigator:{mediaSession:{setActionHandler(action,handler){sessionActions[action]=handler},setPositionState(){}},audioSession},
 setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,Event:class{},
 confirm:()=>true,prompt:()=>null,queueMicrotask,location:{origin:'https://test.example'},
 dispatchEvent(){},addEventListener:(n,f)=>handlers[n]=f,rajaAuthReady:Promise.resolve({configured:false,user:null}),
 rajaLibrary:{items:async()=>[{id:'f1',name:'first.wav'},{id:'f2',name:'second.wav'}],getBlob:async()=>({type:''})},
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
 await find(get('lessonLists'),'تشغيل القائمة').onclick();await flush();
 const audio=get('lessonAudio');assert.equal(audio.paused,false);assert.equal(audio.currentTime,0);
 context.document.hidden=true;docHandlers.visibilitychange();assert.equal(audio.paused,false);
 assert.equal(sessionActions.play,null);assert.equal(sessionActions.pause,null);assert.equal(sessionActions.stop,null);
 const source=audio.src;audio.currentTime=8;
 for(let i=0;i<3;i++){audio.pause();await flush();assert.equal(audio.src,source);assert.equal(context.navigator.mediaSession.playbackState,'none');await audio.play();await new Promise(r=>setTimeout(r,5));assert.equal(audio.paused,false);assert.equal(audio.currentTime,8);assert.deepEqual(audioTypes.slice(-2),['ambient','playback'])}
 // Merely returning to a paused player must not restart it or alter the audio category.
 audio.pause();const beforeForeground=audioTypes.length;context.document.hidden=false;docHandlers.visibilitychange();assert.equal(audio.paused,true);assert.equal(audioTypes.length,beforeForeground);context.document.hidden=true;
 // Local stop/start retains the latest position, including a deliberate seek backwards.
 audio.currentTime=4;audio.ontimeupdate();context.rajaLessons.stop();
 assert.equal(context.rajaLessons.state().position,4);assert.equal(context.rajaLessons.state().resumable,true);
 await context.rajaLessons.toggle();await flush();assert.equal(audio.currentTime,4);assert.equal(audio.paused,false);

 // Free next/previous works even for unvisited tracks; seeking can cross the old daily boundary.
 await context.rajaLessons.step(1);await flush();assert.match(get('lessonNowTitle').textContent,/second/);assert.equal(audio.currentTime,0);
 context.rajaLessons.seek(35);assert.equal(audio.currentTime,35);assert.equal(audio.paused,false);
 await context.rajaLessons.step(-1);await flush();assert.match(get('lessonNowTitle').textContent,/first/);assert.equal(audio.currentTime,0);
 // A goal is informational: crossing it must leave the audio running.
 const list=context.rajaLessons.snapshot()[0];
 // Simulate successive native playback updates rather than a manual seek.
 for(const t of [10,20,30,40]){audio.currentTime=t;audio.ontimeupdate();await flush()}
 assert.match(get('lessonNowTitle').textContent,/second/);
 for(const t of [10,20,30]){audio.currentTime=t;audio.ontimeupdate();await flush()}
 assert.equal(audio.paused,false);assert.ok(context.rajaLessons.state().elapsed>=60);assert.equal(context.rajaLessons.state().goalReached,true);
 audio.pause();audio.currentTime=12;audio.ontimeupdate();context.rajaLessons.stop();
 clock+=86400000;assert.equal(context.rajaLessons.state().position,12);assert.equal(context.rajaLessons.state().index,2);assert.equal(context.rajaLessons.state().elapsed,0);
 await context.rajaLessons.toggle();await flush();assert.equal(audio.currentTime,12);
 get('lessonReplay').onclick();await flush();assert.equal(audio.currentTime,0);assert.match(get('lessonNowTitle').textContent,/second/);
 // A newer tab's storage event must not write stale state back over it.
 const latest=stored();latest.name='Other tab';const incoming=JSON.stringify([latest]);storage.set(key,incoming);const before=writes;
 handlers.storage({key,newValue:incoming});assert.equal(writes,before);assert.equal(storage.get(key),incoming);
 assert.equal(audio.paused,true);
 await new Promise(r=>setTimeout(r,5));assert.equal(audioSession.type,'auto');
 console.log('PASS audio category recovery, paused-session preservation, free track navigation, open listening, hidden-page continuity, current-track replay, cross-day resume, cross-tab preservation');
})().catch(e=>{console.error(e);process.exitCode=1});
