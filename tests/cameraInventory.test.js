import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setApiBaseUrl, getCameraInventory, detectCameras } from '../src/lib/services/roverApi.js';

test('normal and fullscreen consumers reuse discovery until an explicit scan', async t => {
 setApiBaseUrl('http://rover');
 const fetch=t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({cameras:[{name:'kreo',formats:[]}]})}));
 const [normal,fullscreen]=await Promise.all([getCameraInventory(),getCameraInventory()]);
 assert.equal(fetch.mock.callCount(),1);assert.equal(normal,fullscreen);
 await getCameraInventory();assert.equal(fetch.mock.callCount(),1);
 await detectCameras();assert.equal(fetch.mock.callCount(),2);
});

test('a late discovery cannot replace the new rover inventory',async t=>{
 setApiBaseUrl('http://old-rover');let finishOld;
 t.mock.method(globalThis,'fetch',async url=>url.startsWith('http://old-rover')?new Promise(resolve=>{finishOld=resolve;}):{ok:true,json:async()=>({cameras:[{name:'new'}]})});
 const old=getCameraInventory();setApiBaseUrl('http://new-rover');await getCameraInventory();
 finishOld({ok:true,json:async()=>({cameras:[{name:'old'}]})});await old;
 assert.equal((await getCameraInventory()).cameras[0].name,'new');
});
