import { writable } from 'svelte/store';
import { apiStatus } from './apiStore.js';
import { getMotorRpms, subscribeMotorRpms } from '../services/roverApi.js';
import { pollEvery } from '../services/polling.js';

// One 5 Hz reader regardless of how many dashboard/fullscreen viewers are open.
// Svelte starts this on the first subscriber and stops it on the last.
export const motorRpmSample = writable({ data: null, fetchedAt: null, error: null }, set => {
    let stop;
    let controller;
    const unsubscribe = apiStatus.subscribe(status => {
        stop?.();
        controller?.abort();
        if (status !== 'connected') {
            set({ data: null, fetchedAt: null, error: 'API disconnected' });
            return;
        }
        controller = new AbortController();
        const signal = controller.signal;
        set({ data: null, fetchedAt: null, error: null });
        let subscribed = false;
        let retryAt = 0;
        stop = pollEvery(async pollSignal => {
            if (Date.now() < retryAt) return;
            try {
                const requestSignal = AbortSignal.any([signal, pollSignal]);
                if (!subscribed) {
                    const subscription = await subscribeMotorRpms(requestSignal);
                    if (subscription?.success === false) throw new Error(subscription.message || 'RPM subscription failed');
                    if (signal.aborted || pollSignal.aborted) return;
                    subscribed = true;
                }
                const result = await getMotorRpms(requestSignal);
                if (pollSignal.aborted || signal.aborted) return;
                if (!result?.success || !result.data) throw new Error(result?.message || 'RPM data unavailable');
                set({ data: result.data, fetchedAt: Date.now(), error: null });
            } catch (error) {
                if (signal.aborted || pollSignal.aborted) return;
                // ROS reconnects clear backend subscriptions without dropping HTTP.
                subscribed = false;
                retryAt = Date.now() + 1000;
                set({ data: null, fetchedAt: null, error: error.message });
            }
        }, 200);
    });
    return () => { unsubscribe(); controller?.abort(); stop?.(); };
});
