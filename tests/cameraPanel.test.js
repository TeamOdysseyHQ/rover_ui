import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const source=readFileSync(new URL('../src/lib/components/panels/H264Viewer.svelte',import.meta.url),'utf8').split('<script lang="ts">')[1].split('</script>')[0].replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm,'');
const script=stripTypeScriptTypes(source)+'\nglobalThis.h={video(v){video=v;},state:()=>state,error:()=>error,metrics:()=>metrics};';
const settle=()=>new Promise(setImmediate);
function setup(props={}){
 const effects=[],peers=[],timers=[],flow=[];
 class Peer{
  constructor(){peers.push(this);}
  onStateChange(fn){this.state=fn;}onMetrics(fn){this.metrics=fn;}onError(fn){this.error=fn;}
  connect(){return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
  async disconnect(){this.closed=true;}
 }
 const context={$props:()=>({offerUrl:'http://rover/offer',targetFps:60,...props}),$state:v=>v,$derived:v=>v,$effect:fn=>effects.push(fn),tick:async()=>{},WebRtcStreamClient:Peer,OpticalFlowService:class{stopAll(){flow.push('stop');}initialize(){flow.push('load');return Promise.resolve();}start(){flow.push('start');}},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){}};
 runInNewContext(script,context);context.h.video({});const cleanup=effects[0]();effects[1]();
 return{h:context.h,peers,timers,flow,cleanup};
}
test('shared H264 viewer releases only its peer and ignores stale callbacks',async()=>{
 const{h,peers,cleanup}=setup();await settle();const p=peers[0];p.state('connected');p.resolve();await settle();p.metrics({fps:60});assert.equal(h.metrics().fps,60);cleanup();assert.equal(p.closed,true);p.metrics({fps:1});assert.equal(h.metrics().fps,60);
});
test('capacity errors remain errors without transport fallback or retry',async()=>{
 const{h,peers,timers,cleanup}=setup();await settle();const reason=Object.assign(new Error('capacity reached'),{status:429});peers[0].error(reason);peers[0].reject(reason);await settle();assert.equal(h.error(),'capacity reached');assert.equal(timers.length,0);assert.equal(peers[0].closed,true);cleanup();
});
test('callback and rejected negotiation schedule only one recovery',async()=>{
 const{peers,timers,cleanup}=setup();await settle();const reason=new Error('ICE failed');peers[0].error(reason);peers[0].reject(reason);await settle();assert.equal(timers.length,1);assert.equal(timers[0].delay,2000);cleanup();timers[0].fn();await settle();assert.equal(peers.length,1);
});
test('ordinary viewing leaves optical-flow diagnostics unloaded',async()=>{
 const{flow,cleanup}=setup();await settle();assert.ok(!flow.includes('load'));cleanup();
});

test('suspended background viewer does not create a WebRTC peer',async()=>{
 const{h,peers,flow}=setup({suspended:true});await settle();assert.equal(peers.length,0);assert.equal(h.state(),'paused');assert.ok(!flow.includes('load'));
});
