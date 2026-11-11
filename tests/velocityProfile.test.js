import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VelocityProfile, PROFILE_DEFAULTS } from '../src/lib/services/velocityProfile.js';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const target = linear => ({ linear, angular: linear === 0 ? 0 : -linear });

test('S-curve reaches the target analytically, with comfortable default acceleration', () => {
    const profile = new VelocityProfile();
    profile.setTarget(target(1));
    close(profile.advance(.25).output.linear, .0125);
    close(profile.advance(.25).acceleration.linear, .2);
    close(profile.advance(4.5).output.linear, .95);
    const end = profile.advance(.5);
    assert.deepEqual(end.output, target(1));
    assert.deepEqual(end.acceleration, target(0));
});

test('0.33 m/s² is configurable and larger acceleration is rejected', () => {
    const profile = new VelocityProfile({ ...PROFILE_DEFAULTS, linearAcceleration: .33 });
    profile.setTarget(target(1));
    close(profile.advance(1).acceleration.linear, .33);
    assert.throws(() => profile.configure({ ...PROFILE_DEFAULTS, linearAcceleration: .34 }), /0.33/);
    assert.throws(() => profile.configure({ ...PROFILE_DEFAULTS, linearJerk: NaN }), /Invalid/);
    assert.throws(() => profile.setTarget(target(Infinity)), /finite/);
});

test('release decelerates smoothly and reversal preserves current acceleration', () => {
    const profile = new VelocityProfile(); profile.setTarget(target(1)); profile.advance(2);
    const before = profile.snapshot(); profile.setTarget(target(0));
    assert.deepEqual(profile.snapshot().output, before.output);
    assert.deepEqual(profile.snapshot().acceleration, before.acceleration);
    profile.advance(.25);
    close(profile.snapshot().acceleration.linear, .1);
    profile.setTarget(target(-1));
    assert.deepEqual(profile.advance(20).output, target(-1));
    assert.deepEqual(profile.snapshot().acceleration, target(0));
});

test('irregular ticks yield the same trajectory as exact phase integration', () => {
    const coarse = new VelocityProfile(), fine = new VelocityProfile();
    for (const [velocity, duration] of [[1, 1.127], [.31, .197], [-1, 2.349], [0, 5.003]]) {
        coarse.setTarget(target(velocity)); fine.setTarget(target(velocity));
        coarse.advance(duration);
        let left = duration;
        while (left > 1e-9) { const step = Math.min(left, .017); fine.advance(step); left -= step; }
        for (const axis of ['linear', 'angular']) {
            close(coarse.snapshot().output[axis], fine.snapshot().output[axis]);
            close(coarse.snapshot().acceleration[axis], fine.snapshot().acceleration[axis]);
        }
    }
});

test('random retargeting obeys acceleration, jerk, and velocity bounds on both axes', () => {
    let seed = 42;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const profile = new VelocityProfile({ ...PROFILE_DEFAULTS, linearAcceleration: .33 });
    for (let i = 0; i < 30000; i++) {
        const before = profile.snapshot();
        if (i % 17 === 0) {
            profile.setTarget({ linear: random() * 2 - 1, angular: random() * 2 - 1 });
            assert.deepEqual(profile.snapshot().output, before.output);
            assert.deepEqual(profile.snapshot().acceleration, before.acceleration);
        }
        const dt = .001 + random() * .07, after = profile.advance(dt);
        for (const axis of ['linear', 'angular']) {
            const acceleration = axis === 'linear' ? .33 : .4, jerk = axis === 'linear' ? .4 : .8;
            assert.ok(Math.abs(after.output[axis]) <= 1 + 1e-8);
            assert.ok(Math.abs(after.acceleration[axis]) <= acceleration + 1e-8);
            assert.ok(Math.abs(after.acceleration[axis] - before.acceleration[axis]) <= jerk * dt + 1e-8);
            assert.ok(Math.abs(after.output[axis] - before.output[axis]) <= acceleration * dt + 1e-8);
        }
    }
    profile.setTarget(target(0));
    assert.deepEqual(profile.advance(20).output, target(0));
});
