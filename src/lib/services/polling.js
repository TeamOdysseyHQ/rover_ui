// Schedule after completion so a slow request cannot build a polling backlog.
export function pollEvery(task, intervalMs) {
    const controller = new AbortController();
    let timer;
    const tick = async () => {
        if (controller.signal.aborted) return;
        const started = performance.now();
        try { await task(controller.signal); }
        catch (error) {
            if (!controller.signal.aborted) console.debug('Polling request failed:', error);
        }
        if (!controller.signal.aborted) timer = setTimeout(tick, Math.max(0, intervalMs - (performance.now() - started)));
    };
    void tick();
    return () => { controller.abort(); clearTimeout(timer); };
}
