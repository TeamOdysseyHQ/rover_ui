import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dejelloHint, dejelloUrlFor } from '../src/lib/services/onboardDejello.ts';

test('named camera offers map to their onboard de-jello endpoint', () => {
    assert.equal(dejelloUrlFor('http://192.168.1.3:6767/api/nav/cameras/science/webrtc/offer'),
        'http://192.168.1.3:6767/api/nav/cameras/science/dejello');
    assert.equal(dejelloUrlFor('http://rover/api/sci/microscope/webrtc/offer'), null);
    assert.equal(dejelloUrlFor('http://rover/api/nav/ros/camera/webrtc/offer?topic_name=%2Fcam'), null);
    assert.equal(dejelloUrlFor('not a url'), null);
});

test('operator hint explains why frames are not corrected yet', () => {
    const base = { enabled: true, source: 'imu', active_source: null, calibrated: false, calibration: null, last_fit: null, samples: 12,
        gyro: { samples: 90, age_ms: 40, rate_hz: 29.5 }, readout_ms: 26, readout_source: 'estimated', video_readout: null,
        stats: { frames: 10, corrected: 0, no_gyro: 0, no_flow: 0, warp_px: 0, correct_ms: 0, flow_ms: 5, video_flow_ms: 0 } };
    assert.equal(dejelloHint({ ...base, enabled: false }), '');
    assert.match(dejelloHint({ ...base, gyro: { samples: 0, age_ms: null, rate_hz: 0 } }), /imu\/data/);
    assert.match(dejelloHint(base), /Calibrating.*12 frames/);
    assert.match(dejelloHint({ ...base, last_fit: { ok: false, reason: 'Not enough rotation yet', samples: 70 } }), /rotation/);
    assert.equal(dejelloHint({ ...base, calibrated: true, stats: { ...base.stats, corrected: 10 } }), '');
});

test('video and auto sources explain the fallback instead of waiting for the IMU', () => {
    const base = { enabled: true, source: 'video', active_source: 'video', calibrated: false, calibration: null, last_fit: null, samples: 0,
        gyro: { samples: 0, age_ms: null, rate_hz: 0 }, readout_ms: 13, readout_source: 'video', video_readout: null,
        stats: { frames: 10, corrected: 9, no_gyro: 0, no_flow: 1, warp_px: 6, correct_ms: 6, flow_ms: 0, video_flow_ms: 9 } };
    assert.equal(dejelloHint(base), '');
    assert.match(dejelloHint({ ...base, active_source: null }), /features/);
    assert.match(dejelloHint({ ...base, source: 'auto' }), /No IMU data; using video/);
    assert.match(dejelloHint({ ...base, source: 'auto', gyro: { samples: 90, age_ms: 30, rate_hz: 29 } }), /until the IMU is calibrated/);
});
