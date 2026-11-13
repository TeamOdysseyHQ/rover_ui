import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

test('the RPM panel plots new messages once and restores cached numbers after fullscreen', () => {
 let source=readFileSync(new URL('../src/lib/components/panels/MotorRpmPanel.svelte',import.meta.url),'utf8').split('<script lang="ts">')[1].split('</script>')[0];
 source=source.replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?/gm,'')
  .replace("import('svelte-chartjs')",'Promise.resolve({Line:{}})')
  .replace("import('chart.js')",'Promise.resolve({Chart:{register(){}}})');
 const effects=[],mounts=[],callbacks=[];let releases=0;
 const document=new EventTarget();document.hidden=false;
 const context={document,browser:true,$state:v=>v,$derived:v=>v,$effect:fn=>effects.push(fn),onMount:fn=>mounts.push(fn),untrack:fn=>fn(),$isFullscreen:false,
  watchMotorRpms:cb=>{callbacks.push(cb);cb({data:null,error:null});return ()=>{releases++;};}};
 runInNewContext(stripTypeScriptTypes(source)+'\nglobalThis.h={stop,current:()=>current,points:()=>timeLabels.length};',context);
 const unmount=mounts[0]();let release=effects[0]();
 const sample={data:{front_left:42},sampleId:'100:1',error:null};
 callbacks.at(-1)(sample);callbacks.at(-1)(sample);
 assert.equal(context.h.points(),1);
 release();context.$isFullscreen=true;assert.equal(effects[0](),undefined);assert.equal(callbacks.length,1);
 context.$isFullscreen=false;release=effects[0]();assert.equal(context.h.current().front_left,null);
 callbacks.at(-1)(sample);assert.equal(context.h.current().front_left,42);assert.equal(context.h.points(),1);
 callbacks.at(-1)({...sample,sampleId:'101:2'});assert.equal(context.h.points(),2);
 context.h.stop();release();assert.equal(effects[0](),undefined);assert.equal(releases,2);unmount();
});
