import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DriveCommandQueue } from '../src/lib/services/driveCommandQueue.js';

test('command queue coalesces movement and preserves stop before subsequent motion', async () => {
    const sent = []; let release;
    const queue = new DriveCommandQueue(async command => {
        sent.push(command.linear);
        if (sent.length === 1) await new Promise(resolve => { release = resolve; });
    }, error => { throw error; });
    queue.submit({ linear: 0.1, angular: 0 });
    await Promise.resolve();
    queue.submit({ linear: 0.2, angular: 0 });
    queue.submit({ linear: 0.3, angular: 0 });
    queue.submit({ linear: 0, angular: 0 });
    const finished = queue.submit({ linear: -0.1, angular: 0 });
    release(); await finished;
    assert.deepEqual(sent, [0.1, 0, -0.1]);
});

test('command failures discard queued movement and report once', async () => {
    const errors = []; const sent = [];
    const queue = new DriveCommandQueue(async command => { sent.push(command); throw Error('offline'); }, error => errors.push(error));
    const finished = queue.submit({ linear: 1, angular: 0 });
    await finished;
    assert.equal(errors.length, 1); assert.equal(sent.length, 1);
    assert.equal(queue.pending, null);
});
