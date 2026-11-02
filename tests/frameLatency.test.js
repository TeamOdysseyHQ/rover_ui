import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FrameLatencySampler } from '../src/lib/services/webRtcMetrics.ts';
test('timestamp matching removes a large clock offset and does not double-count frames',()=>{
 const s=new FrameLatencySampler();s.record(123,1020);s.sample({server_receive_ms:20051,server_send_ms:20053,frames:[[123,19980]]},1050,1054);
 assert.deepEqual(s.metrics(),{latencyMs:40,clockUncertaintyMs:1});
 s.sample({server_receive_ms:20151,server_send_ms:20153,frames:[[123,19980]]},1150,1160);assert.equal(s.metrics().latencyMs,40);
});
test('malformed diagnostics cannot manufacture a valid latency reading',()=>{
 const s=new FrameLatencySampler();s.record(1,1000);for(const data of[null,{}, {server_receive_ms:NaN,server_send_ms:2,frames:[]},{server_receive_ms:100,server_send_ms:99,frames:[]}])s.sample(data,1,2);assert.deepEqual(s.metrics(),{});
});
