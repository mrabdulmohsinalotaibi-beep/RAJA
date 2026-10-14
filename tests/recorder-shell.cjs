const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Node{
 constructor(){this.children=[];this.dataset={};this.hidden=false;this.value='';this.style={setProperty(){}};this.attributes={};const c=new Set();this.classList={add:x=>c.add(x),remove:x=>c.delete(x),toggle:(x,on)=>on?c.add(x):c.delete(x),contains:x=>c.has(x)}}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}setAttribute(k,v){this.attributes[k]=v}
 addEventListener(k,f){this['on'+k]=f}querySelector(){return this.svg||=new Node()}showModal(){this.open=true}close(){this.open=false}
}
const ids=new Map(),get=id=>{if(!ids.has(id))ids.set(id,new Node());return ids.get(id)};
const tabs=['organizer','search','settings','files','downloads'].map(t=>{const n=new Node();n.dataset.tabButton=t;return n});
const panels=tabs.map(t=>{const n=new Node();n.dataset.tabPanel=t.dataset.tabButton;return n});
const legal=['privacy','terms'].map(t=>{const n=new Node();n.dataset.legal=t;return n});
const main=new Node();let calls=[];
let state={name:'My list',title:'My lesson',index:1,count:2,minutes:30,start:'05:00',position:10,duration:40,elapsed:10,playing:true,picture:false,active:true,done:false};
const context={console,Intl,Date,URLSearchParams,Event:class{},location:{search:''},setTimeout,clearTimeout,setInterval:()=>1,
 localStorage:{getItem:()=>null,setItem(){}},navigator:{},
 document:{getElementById:get,createElement:()=>new Node(),createElementNS:()=>new Node(),querySelector:()=>main,querySelectorAll:s=>s==='[data-tab-button]'?tabs:s==='[data-tab-panel]'?panels:s==='[data-legal]'?legal:[]},
 rajaLessons:{state:()=>state,toggle:()=>calls.push('toggle'),replay:()=>calls.push('replay'),step:n=>calls.push('step:'+n),seekBy:n=>calls.push('seekBy:'+n),seek:n=>calls.push('seek:'+n)}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../app-shell.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(require.resolve('../recorder.js'),'utf8'),context);
assert.equal(get('managementScreen').hidden,true);assert.equal(get('recorderScreen').hidden,false);assert.equal(get('recorderTitle').textContent,'My lesson');
get('recorderMenu').onclick();assert.equal(get('managementScreen').hidden,false);assert.equal(get('recorderScreen').hidden,true);assert.ok(main.classList.contains('is-managing'));
assert.equal(panels.find(p=>p.dataset.tabPanel==='organizer').hidden,false);
context.rajaSwitchTab('settings');assert.equal(panels.find(p=>p.dataset.tabPanel==='settings').hidden,false);
get('recorderBack').onclick();assert.equal(get('recorderScreen').hidden,false);assert.equal(get('managementScreen').hidden,true);assert.deepEqual(calls,[]);
get('recorderPlay').onclick();get('recorderReplay').onclick();get('recorderPrevious').onclick();get('recorderNext').onclick();get('recorderBack10').onclick();get('recorderForward10').onclick();get('recorderSeek').oninput({target:{value:12}});
assert.deepEqual(calls,['toggle','replay','step:-1','step:1','seekBy:-10','seekBy:10','seek:12']);
assert.equal(get('recorderSeek').disabled,false);assert.equal(get('recorderPlay').attributes['aria-label'],'إيقاف مؤقت');
legal[0].onclick();assert.equal(get('legalDialog').open,true);assert.equal(get('legalTitle').textContent,'الخصوصية');get('legalClose').onclick();assert.equal(get('legalDialog').open,false);
console.log('PASS fixed player defaults, separate management, return without playback changes, all player controls, legal dialogs');
