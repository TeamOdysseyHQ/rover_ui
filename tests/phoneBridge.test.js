import assert from 'node:assert/strict';
import { test } from 'node:test';
import net from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createPhoneBridge } from '../scripts/phone-bridge.mjs';

function inbox(emitter, event) {
    const queue = [], waiters = [];
    emitter.on(event, raw => {
        const value = JSON.parse(raw.toString()); const index = waiters.findIndex(wait => wait.predicate(value));
        if (index < 0) queue.push(value);
        else { const [wait] = waiters.splice(index, 1); clearTimeout(wait.timer); wait.resolve(value); }
    });
    return predicate => {
        const index = queue.findIndex(predicate); if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
        return new Promise((resolve, reject) => { const wait = { predicate, resolve, timer: setTimeout(() => reject(Error('Timed out waiting for bridge message')), 2000) }; waiters.push(wait); });
    };
}
async function fixture(t) {
    const bridge = await createPhoneBridge({ httpPort: 0, phonePort: 0 });
    t.after(() => bridge.close());
    const dashboard = new WebSocket(`ws://127.0.0.1:${bridge.httpPort}/dashboard`, { headers: { Origin: 'http://127.0.0.1:5190' } });
    const receive = inbox(dashboard, 'message'); await once(dashboard, 'open');
    const timer = setInterval(() => dashboard.send(JSON.stringify({ type: 'status', linear: 0, angular: 0, latched: false, ready: true })), 50);
    t.after(() => clearInterval(timer));
    const phone = net.createConnection({ host: '127.0.0.1', port: bridge.phonePort }); phone.setEncoding('utf8');
    const lines = new (await import('node:events')).EventEmitter(); let buffer = '';
    phone.on('data', raw => { buffer += raw; let end; while ((end = buffer.indexOf('\n')) >= 0) { lines.emit('line', buffer.slice(0, end)); buffer = buffer.slice(end + 1); } });
    const phoneReceive = inbox(lines, 'line'); await once(phone, 'connect');
    const send = value => phone.write(JSON.stringify(value) + '\n');
    return { bridge, dashboard, receive, phone, phoneReceive, send };
}

test('USB TCP input reaches one dashboard, echoes timestamps, and reports acknowledgment latency', async t => {
    const f = await fixture(t);
    f.send({ type: 'input', seq: 1, phone_ms: 10, linear: .4, angular: -.2, held: true, locked: false });
    const value = await f.receive(v => v.type === 'input'); assert.equal(value.linear, .4);
    const ack = await f.phoneReceive(v => v.type === 'ack'); assert.equal(ack.phone_ms, 10); assert.ok(ack.host_tx_ms >= ack.host_rx_ms);
    f.dashboard.send(JSON.stringify({ type: 'applied', seq: 1 }));
    assert.equal((await f.phoneReceive(v => v.type === 'applied')).phone_ms, 10);
    assert.equal(f.bridge.report().dashboard_ack_ms.count, 1);
    const health = await fetch(`http://127.0.0.1:${f.bridge.httpPort}/health`).then(r => r.json()); assert.equal(health.inputCount, 1);
});

test('phone timeout notifies the dashboard instead of preserving a velocity lock', async t => {
    const f = await fixture(t);
    f.send({ type: 'input', seq: 1, phone_ms: 10, linear: .4, angular: 0, held: false, locked: true });
    const gone = await f.receive(v => v.type === 'gone'); assert.match(gone.reason, /heartbeat/);
});

test('malformed targets disconnect and untrusted browser origins are rejected', async t => {
    const f = await fixture(t);
    f.send({ type: 'input', seq: 1, phone_ms: 10, linear: 4, angular: 0, held: true, locked: false });
    assert.match((await f.receive(v => v.type === 'gone')).reason, /Invalid joystick/);
    const intruder = new WebSocket(`ws://127.0.0.1:${f.bridge.httpPort}/dashboard`, { headers: { Origin: 'https://example.com' } });
    await new Promise(resolve => intruder.once('error', resolve));
});

test('valid JSON null cannot crash the bridge', async t => {
    const f = await fixture(t); f.send(null);
    assert.match((await f.receive(v => v.type === 'gone')).reason, /Invalid phone message/);
    assert.equal((await fetch(`http://127.0.0.1:${f.bridge.httpPort}/health`)).status, 200);
});
