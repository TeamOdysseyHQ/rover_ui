import { readable, writable } from 'svelte/store';
import { apiStatus } from './apiStore.js';
import { getMotorRpms, subscribeMotorRpms } from '../services/roverApi.js';
import { pollEvery } from '../services/polling.js';

const empty = { data: null, fetchedAt: null, ageMs: null, sampleId: null, error: null, polling: false };
// Health displays observe this cache without keeping network polling alive.
export const motorRpmSample = writable(empty);

const reader = readable(null, () => {
    let stop;
    let status;
    function update() {
        stop?.();
        stop = undefined;
        const polling = status === 'connected' && !(typeof document !== 'undefined' && document.hidden);
        motorRpmSample.set({ ...empty, polling, error: status === 'connected' ? null : 'API disconnected' });
        if (!polling) return;
        let subscribed = false;
        let retryAt = 0;
        stop = pollEvery(async signal => {
            if (Date.now() < retryAt) return;
            try {
                if (!subscribed) {
                    const subscription = await subscribeMotorRpms(signal);
                    if (subscription?.success === false) throw new Error(subscription.message || 'RPM subscription failed');
                    if (signal.aborted) return;
                    subscribed = true;
                }
                const result = await getMotorRpms(signal);
                if (signal.aborted) return;
                if (!result?.success || !result.data) throw new Error(result?.message || 'RPM data unavailable');
                const data = result.data;
                const ageMs = Number.isFinite(data.age_ms) ? data.age_ms : null;
                const sampleId = Number.isFinite(data.sample_id) && Number.isFinite(data.received_at_ms)
                    ? `${data.received_at_ms}:${data.sample_id}` : null;
                const stale = ageMs !== null && ageMs > 2000;
                if (stale) retryAt = Date.now() + 1000;
                motorRpmSample.set({ data: stale ? null : data, fetchedAt: Date.now(), ageMs, sampleId, polling: true, error: stale ? 'Motor RPM sample is stale' : null });
            } catch (error) {
                if (signal.aborted) return;
                subscribed = false;
                retryAt = Date.now() + 1000;
                motorRpmSample.set({ ...empty, polling: true, error: error.message });
            }
        }, 200);
    }
    const unsubscribe = apiStatus.subscribe(value => { status = value; update(); });
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
    return () => {
        unsubscribe(); stop?.();
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', update);
        motorRpmSample.update(sample => ({ ...sample, polling: false }));
    };
});

// Only visible RPM consumers acquire the shared reader.
export function watchMotorRpms(callback) {
    const release = reader.subscribe(() => {});
    const unsubscribe = motorRpmSample.subscribe(callback);
    return () => { unsubscribe(); release(); };
}
