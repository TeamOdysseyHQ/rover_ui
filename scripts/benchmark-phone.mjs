import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const base = process.env.PHONE_BRIDGE_HTTP ?? 'http://127.0.0.1:8910';
const before = await fetch(`${base}/health`).then(r => r.json());
if (!before.phone) throw Error('Connect the authorized phone, configure adb reverse, and open Rover Joystick first.');
const response = await fetch(`${base}/benchmark`, { method: 'POST' });
if (!response.ok) throw Error(`Benchmark refused: ${response.status}`);
let report;
for (let i = 0; i < 200; i++) {
    await delay(100); report = await fetch(`${base}/health`).then(r => r.json());
    if (!report.phone) throw Error('Phone disconnected during benchmark');
    if (report.probeCount >= 500) break;
}
if (report.probeCount < 500) throw Error(`Only ${report.probeCount}/500 probes arrived`);
await delay(300); report = await fetch(`${base}/health`).then(r => r.json());
const result = { measuredAt: new Date().toISOString(), transport: 'Android TCP over ADB reverse / USB', units: 'milliseconds',
    scope: 'Synthetic command-sized probe receipt and acknowledgment. Does not measure physical touch, ROS, motor response, or camera latency.',
    oneWay: 'Estimate from minimum-RTT two-way clock mapping; uncertainty is half that RTT. RTT measurements do not require synchronized clocks.', ...report };
const output = process.argv[2] ?? '.local/phone-latency-latest.json';
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
console.log(`Saved ${output}`);
