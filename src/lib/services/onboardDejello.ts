/**
 * Control for IMU rolling-shutter correction running on the rover computer.
 *
 * The BNO055 gyro, onboard optical flow, calibration and per-frame correction all
 * run in the RoverAPI camera worker; frames are corrected before H.264 encoding.
 * Gyro data never leaves the rover; this client only sees a status summary.
 */

export type DejelloSource = 'auto' | 'imu' | 'video';

export type OnboardDejelloStatus = {
    enabled: boolean;
    /** Requested motion source; active_source is what corrected the latest frame (null: shown as captured). */
    source: DejelloSource;
    active_source: 'imu' | 'video' | null;
    calibrated: boolean;
    calibration: {
        fit: number; offset_ms: number; readout_ms: number; readout_fitted: boolean;
        roll_fitted: boolean; samples: number; width: number; height: number;
    } | null;
    last_fit: { ok: boolean; reason?: string; samples: number; excitation?: number[] } | null;
    samples: number;
    gyro: { samples: number; age_ms: number | null; rate_hz: number };
    readout_ms: number;
    readout_source: 'fitted' | 'manual' | 'video' | 'estimated';
    video_readout: { readout_ms: number; correlation: number; pairs: number } | null;
    stats: { frames: number; corrected: number; no_gyro: number; no_flow: number; warp_px: number; correct_ms: number; flow_ms: number; video_flow_ms: number };
    imu_relay?: { subscribed: boolean; received: number; last_age_ms: number | null };
};

export type DejelloUpdate = { enabled?: boolean; source?: DejelloSource; readout_ms?: number; reset_readout?: boolean; reset_calibration?: boolean };

/** Correction endpoint for a named camera's offer URL, or null for sources that have none. */
export function dejelloUrlFor(offerUrl: string): string | null {
    try {
        const url = new URL(offerUrl);
        const match = url.pathname.match(/^(.*\/api\/nav\/cameras\/[^/]+)\/webrtc\/offer\/?$/);
        if (!match) return null;
        url.pathname = `${match[1]}/dejello`;
        url.search = '';
        return url.toString();
    } catch {
        return null;
    }
}

async function call(url: string, init: RequestInit, signal?: AbortSignal): Promise<OnboardDejelloStatus> {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(6000)]) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail ?? `De-jello request failed (HTTP ${response.status})`);
    if (!body?.dejello || typeof body.dejello.enabled !== 'boolean') throw new Error('Invalid de-jello status');
    return body.dejello;
}

export function getDejello(url: string, signal?: AbortSignal): Promise<OnboardDejelloStatus> {
    return call(url, { method: 'GET' }, signal);
}

export function updateDejello(url: string, update: DejelloUpdate, signal?: AbortSignal): Promise<OnboardDejelloStatus> {
    return call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) }, signal);
}

/** One-line operator hint, or '' when correction is running normally. */
export function dejelloHint(status: OnboardDejelloStatus): string {
    if (!status.enabled) return '';
    if (status.source === 'video') {
        return status.active_source === 'video' ? '' : 'Too few tracked features; frames shown uncorrected';
    }
    const gyroAge = status.gyro.age_ms;
    const gyroLive = status.gyro.samples > 0 && gyroAge !== null && gyroAge <= 1000;
    if (status.source === 'auto' && status.active_source === 'video') {
        return gyroLive ? 'Using video motion until the IMU is calibrated' : 'No IMU data; using video motion';
    }
    if (!gyroLive) return 'Waiting for /imu/data on the rover';
    if (status.calibrated) return status.stats.no_gyro > status.stats.corrected ? 'Gyro data is late; frames shown uncorrected' : '';
    if (status.last_fit && !status.last_fit.ok && status.last_fit.reason) return status.last_fit.reason;
    return `Calibrating: rock the rover body with the camera (${status.samples} frames)`;
}
