import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import { test } from 'node:test';
import { getRoverAddress, sendMagicPacket } from '../src/lib/server/wakeOnLan.js';

const entry = address => ({ family: 'IPv4', internal: false, netmask: '255.255.255.0', address });

test('wake packets use the rover subnet rather than the Wi-Fi default route', () => {
    assert.equal(getRoverAddress({ wifi: [entry('172.29.10.90')], ethernet: [entry('192.168.1.159')] }), '192.168.1.159');
    assert.equal(getRoverAddress({ wifi: [entry('172.29.10.90')] }), null);
    assert.equal(getRoverAddress({ wifi: [entry('192.168.1.4')], ethernet: [entry('192.168.1.159')] }), null);
    assert.equal(getRoverAddress({ ethernet: [{ ...entry('192.168.1.159'), netmask: '255.255.0.0' }] }), null);
});

test('real UDP delivery contains three valid magic packets for the OptiPlex', { timeout: 3000 }, async t => {
    const receiver = createSocket('udp4');
    t.after(() => receiver.close());
    receiver.bind(0, '127.0.0.1');
    await once(receiver, 'listening');
    const packets = [];
    const received = new Promise(resolve => receiver.on('message', (packet, remote) => {
        packets.push(packet);
        assert.equal(remote.address, '127.0.0.1');
        if (packets.length === 3) resolve();
    }));
    await sendMagicPacket({ address: '127.0.0.1', broadcast: '127.0.0.1', port: receiver.address().port });
    await received;
    for (const packet of packets) {
        assert.equal(packet.length, 102);
        assert.deepEqual(packet.subarray(0, 6), Buffer.alloc(6, 0xff));
        for (let offset = 6; offset < 102; offset += 6) {
            assert.equal(packet.subarray(offset, offset + 6).toString('hex'), '6c3c8c0a6e17');
        }
    }
});

test('a missing local address rejects instead of reporting that a wake signal was sent', async () => {
    await assert.rejects(sendMagicPacket({ address: '203.0.113.254' }), { code: 'EADDRNOTAVAIL' });
});
