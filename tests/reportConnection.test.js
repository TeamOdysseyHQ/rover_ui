import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setApiBaseUrl, fetchReport } from '../src/lib/services/roverApi.js';
import * as science from '../src/lib/services/scienceReportService.ts';
import * as nav from '../src/lib/services/navigationReportService.ts';

test('all report operations follow the selected rover and have deadlines', async t => {
 const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({success:true,reports:[],report_ids:[]}),blob:async()=>new Blob(['pdf'])};});
 const operations=[()=>science.generateReport('inference'),()=>science.downloadReportById('id'),()=>science.downloadReportByPath('/report.pdf'),()=>science.downloadReport('id'),()=>science.listReportIds(),()=>science.getReportsMetadata(),()=>science.deleteReport('id'),()=>nav.generateNavReport('notes'),()=>nav.downloadNavReportById('id'),()=>nav.listNavReportIds(),()=>nav.getNavReportsMetadata(),()=>nav.deleteNavReport('id')];
 for(const host of ['http://first-rover','http://second-rover']){
  setApiBaseUrl(host);
  for(const operation of operations){await operation();const r=requests.at(-1);assert.ok(r.url.startsWith(host+'/api/'));assert.ok(r.options.signal instanceof AbortSignal);assert.equal(r.options.signal.aborted,false);}
 }
});

test('changing rover cancels a pending report and an aborted download is not retried',async t=>{
 let signal,calls=0;
 t.mock.method(globalThis,'fetch',(_url,options)=>{calls++;signal=options.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
 setApiBaseUrl('http://first-rover');
 const pending=science.downloadReportByPath('/report.pdf');
 setApiBaseUrl('http://second-rover');
 assert.equal(signal.aborted,true);assert.equal(await pending,null);assert.equal(calls,1);
});

test('report deadline aborts stalled requests and caller cancellation is preserved',async t=>{
 let signal;
 t.mock.method(globalThis,'fetch',(_url,options)=>{signal=options.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});
 const pending=fetchReport('/slow',{timeoutMs:10});
 // Keep the test alive while AbortSignal.timeout uses an unref'd timer.
 const keepAlive=setTimeout(()=>{},1000);
 try{await assert.rejects(pending,{name:'TimeoutError'});assert.equal(signal.aborted,true);}finally{clearTimeout(keepAlive);}
 const controller=new AbortController();const cancelled=fetchReport('/slow',{signal:controller.signal});controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
});
