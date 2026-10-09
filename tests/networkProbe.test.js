import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { probeTcp } from '../src/lib/server/networkProbe.js';

const target = { id: 'rover', host: '192.168.1.3', port: 22 };
const socket = () => Object.assign(new EventEmitter(), { destroyed: false, destroy() { this.destroyed = true; } });

test('successful and refused probes release sockets and retain evidence', async () => {
    for (const reachable of [true, false]) {
        const client = socket();
        const result = probeTcp(target, 1200, () => client);
        reachable ? client.emit('connect') : client.emit('error', { code: 'ECONNREFUSED' });
        const report = await result;
        assert.equal(report.reachable, reachable);
        assert.equal(report.error, reachable ? null : 'ECONNREFUSED');
        assert.equal(client.destroyed, true);
        assert.equal(report.host, target.host);
    }
});

test('a stalled TCP connection is bounded by an absolute deadline', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const client = socket();
    const result = probeTcp(target, 1200, () => client);
    t.mock.timers.tick(1200);
    assert.equal((await result).error, 'timeout');
    assert.equal(client.destroyed, true);
    client.emit('connect');
    assert.equal((await result).reachable, false);
});
