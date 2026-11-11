function pause(ms, signal) {
    return new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, ms);
        signal.addEventListener('abort', abort, { once: true });
    });
}

export async function wakeRover({ signal, onSent, timeoutMs = 120000, intervalMs = 3000 }) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const combined = AbortSignal.any([signal, deadline]);
    try {
        combined.throwIfAborted();
        const response = await fetch('/api/rover-power', {
            method: 'POST',
            signal: AbortSignal.any([combined, AbortSignal.timeout(5000)])
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.sent !== true) {
            throw new Error(typeof result?.message === 'string' ? result.message : 'Could not send the wake packet.');
        }
        combined.throwIfAborted();
        onSent();
        while (!combined.aborted) {
            try {
                const status = await fetch('/api/rover-power', {
                    cache: 'no-store',
                    signal: AbortSignal.any([combined, AbortSignal.timeout(3000)])
                });
                if (!status.ok) throw new Error('Wake status is unavailable.');
                const report = await status.json();
                combined.throwIfAborted();
                if (report?.ready === true && report.apiUrl === 'http://192.168.1.3:6767') return report.apiUrl;
            } catch (error) {
                combined.throwIfAborted();
                // Read failures during boot can be retried without sending more wake packets.
            }
            await pause(intervalMs, combined);
        }
        combined.throwIfAborted();
    } catch (error) {
        if (deadline.aborted && !signal.aborted) {
            throw new Error('No API response within two minutes. The computer may still be booting. Check its power, antenna power and Ethernet cable, then try Connect.');
        }
        throw error;
    }
}
