import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diagnoseStack } from '../src/lib/services/faultDiagnosis.js';

const now = 100000;
const input = { online: true, apiStatus: 'error', apiHealth: { error: 'Failed to fetch' }, now };
const network = (ids, checkedAt = now) => ({ checkedAt, probes: ['radio20', 'radio21', 'rover', 'api'].map(id => ({ id, reachable: ids.includes(id) })) });

test('local offline evidence wins and healthy API never implies healthy actuators', () => {
    assert.match(diagnoseStack({ ...input, online: false }).title, /Local device/);
    const healthy = diagnoseStack({ ...input, apiStatus: 'connected', apiHealth: { lastChecked: now, error: null }, rosStatus: { status: 'connected', lastChecked: now } });
    assert.equal(healthy.level, 'ok');
    assert.match(healthy.detail, /does not verify motor controllers/);
});

test('fresh API evidence isolates ROS and Arduino faults; stale evidence cannot', () => {
    const healthy = { ...input, apiStatus: 'connected', apiHealth: { lastChecked: now }, rosStatus: { status: 'disconnected', lastChecked: now } };
    assert.match(diagnoseStack(healthy).title, /ROS bridge unavailable/);
    assert.match(diagnoseStack({ ...healthy, rosStatus: { status: 'connected', lastChecked: now }, arduino: { connected: false, port: '/dev/ttyACM0', lastChecked: now } }).detail, /ttyACM0/);
    assert.equal(diagnoseStack({ ...healthy, rosStatus: { status: 'disconnected', lastChecked: now - 20000 } }).level, 'unknown');
    assert.equal(diagnoseStack({ ...healthy, rosStatus: { status: 'unknown', lastChecked: now, error: 'timeout' } }).level, 'unknown');
    assert.equal(diagnoseStack({ ...healthy, apiHealth: { lastChecked: now - 20000 } }).level, 'unknown');
});

test('TCP evidence distinguishes listener failure from browser failure without claiming failed hardware', () => {
    assert.match(diagnoseStack({ ...input, network: network(['api']) }).title, /browser health check failed/);
    assert.match(diagnoseStack({ ...input, network: network(['rover']) }).title, /API listener unavailable/);
    assert.match(diagnoseStack({ ...input, network: network(['radio20']) }).title, /host or its network path/);
    assert.match(diagnoseStack({ ...input, network: network([]) }).detail, /do not prove a radio is down/);
    assert.equal(diagnoseStack({ ...input, network: network(['rover'], now - 20000) }).level, 'unknown');
    assert.equal(diagnoseStack({ ...input, network: network(['rover']), defaultTarget: false }).level, 'unknown');
    const refused = network([]);
    refused.probes.forEach(probe => { probe.error = 'ECONNREFUSED'; });
    assert.match(diagnoseStack({ ...input, network: refused }).title, /connections refused/);
});
