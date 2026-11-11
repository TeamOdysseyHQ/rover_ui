import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PhoneControl } from '../src/lib/services/phoneControl.js';

function setup() {
    const requested = [], halted = [], sent = []; let resets = 0;
    const socket = { readyState: 1, bufferedAmount: 0, send: raw => sent.push(JSON.parse(raw)), close() {} };
    const state = { latched: false, connected: false, preview: true, output: { linear: 0, angular: 0 } };
    const control = new PhoneControl({ request: value => { requested.push(value); return true; }, halt: reason => halted.push(reason), resetInputs: () => resets++, snapshot: () => state, createSocket: () => socket });
    control.connect();
    const receive = data => socket.onmessage({ data: JSON.stringify(data) });
    const input = (linear = 0, held = false, locked = false) => receive({ type: 'input', seq: 1, linear, angular: 0, held, locked });
    return { control, input, receive, requested, halted, sent, state, resets: () => resets };
}

test('phone must start neutral, then owns the target until release or unlock', () => {
    const f = setup(); f.input(.5, true); assert.equal(f.requested.length, 0);
    f.input(); f.input(.5, true); assert.equal(f.control.active, true);
    assert.equal(f.resets(), 1); f.input(.5, false, true); assert.equal(f.control.active, true);
    f.input(); assert.equal(f.control.active, false);
    assert.deepEqual(f.requested.at(-1), { linear: 0, angular: 0 }); f.control.close();
});

test('desktop stop resets the phone lock and blocks stale held input until neutral', () => {
    const f = setup(); f.input(); f.input(.5, false, true); f.control.suspend();
    assert.deepEqual(f.sent.at(-1), { type: 'reset' });
    const count = f.requested.length; f.input(.5, false, true); assert.equal(f.requested.length, count);
    f.input(); f.input(.3, true); assert.equal(f.requested.at(-1).linear, .3); f.control.close();
});

test('disconnect and invalid active input halt once; probes never request motion', () => {
    const f = setup(); f.receive({ type: 'probe', seq: 10 }); assert.equal(f.requested.length, 0);
    assert.deepEqual(f.sent.at(-1), { type: 'applied', seq: 10 });
    f.input(); f.input(.4, true); f.receive({ type: 'input', linear: 2, angular: 0, held: true, locked: false });
    assert.equal(f.halted.length, 1); assert.equal(f.control.active, false);
    f.receive({ type: 'gone', reason: 'USB gone' }); assert.equal(f.halted.length, 1); f.control.close();
});

test('emergency latch prevents phone restart even after fresh input', () => {
    const f = setup(); f.input(); f.state.latched = true; f.input(.5, true);
    assert.equal(f.requested.length, 0); f.control.close();
});

test('null frames and nonzero released targets cannot leave motion active', () => {
    for (const invalid of [null, { type: 'input', seq: 2, linear: .5, angular: 0, held: false, locked: false }]) {
        const f = setup(); f.input(); f.input(.5, true); f.receive(invalid);
        assert.equal(f.halted.length, 1); assert.equal(f.control.active, false); f.control.close();
    }
});
