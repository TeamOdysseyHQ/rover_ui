export type WebRtcMetrics = {
    fps: number;
    bitrateBps: number;
    lossRatio: number;
    jitterMs: number;
    decodeMs: number;
    targetFps: number;
    scale: number;
    adaptiveQuality: boolean;
};

/** Interval deltas avoid cumulative-loss bias and survive peer/stat resets. */
export class WebRtcStatsSampler {
    private previous: any = null;

    sample(report: RTCStatsReport): Omit<WebRtcMetrics, 'targetFps' | 'scale' | 'adaptiveQuality'> | null {
        let current: any = null;
        report.forEach(stat => {
            if (stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.mediaType === 'video')) current = stat;
        });
        if (!current) return null;
        const old = this.previous;
        this.previous = current;
        if (!old || old.id !== current.id) return null;
        // Browsers may start exposing decoded counters after the first report.
        // Never subtract a received-frame baseline from a decoded-frame count.
        const frameKey = current.framesDecoded !== undefined ? 'framesDecoded' : 'framesReceived';
        if (old[frameKey] === undefined || current[frameKey] === undefined) return null;
        const seconds = (current.timestamp - old.timestamp) / 1000;
        const frames = current[frameKey] - old[frameKey];
        const bytes = current.bytesReceived - old.bytesReceived;
        const packets = current.packetsReceived - old.packetsReceived;
        if (![seconds, frames, bytes, packets].every(Number.isFinite) || seconds <= 0 || frames < 0 || bytes < 0 || packets < 0) return null;
        const lost = Math.max(0, (current.packetsLost ?? 0) - (old.packetsLost ?? 0));
        const decode = Math.max(0, (current.totalDecodeTime ?? 0) - (old.totalDecodeTime ?? 0));
        const jitter = current.jitter ?? 0;
        if (![lost, decode, jitter].every(Number.isFinite) || jitter < 0) return null;
        return {
            fps: frames / seconds,
            bitrateBps: bytes * 8 / seconds,
            lossRatio: packets + lost > 0 ? lost / (packets + lost) : 0,
            jitterMs: jitter * 1000,
            decodeMs: frames > 0 ? decode * 1000 / frames : 0,
        };
    }
}
