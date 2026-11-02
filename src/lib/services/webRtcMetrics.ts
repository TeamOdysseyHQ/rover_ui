export type WebRtcMetrics = {
    fps: number;
    bitrateBps: number;
    lossRatio: number;
    jitterMs: number;
    decodeMs: number;
    targetFps: number;
    scale: number;
    adaptiveQuality: boolean;
    latencyMs?: number;
    clockUncertaintyMs?: number;
};

/** Join source delivery timestamps to browser presentation callbacks, without holding video frames. */
export class FrameLatencySampler {
    private rendered = new Map<number, number>();
    private clocks: { rtt: number; offset: number; at: number }[] = [];
    private delays: number[] = [];
    private lastRendered = 0;
    record(rtpTimestamp: number, renderedMs: number): void {
        this.rendered.set(rtpTimestamp, renderedMs);
        this.lastRendered = renderedMs;
        while (this.rendered.size > 300) {
            const first = this.rendered.keys().next();
            if (first.done) break;
            this.rendered.delete(first.value);
        }
    }
    sample(value: unknown, sentMs: number, receivedMs: number): void {
        if (!value || typeof value !== 'object' || !('server_receive_ms' in value) || !('server_send_ms' in value) || !('frames' in value)) return;
        const before = value.server_receive_ms, after = value.server_send_ms;
        if (typeof before !== 'number' || typeof after !== 'number' || !Array.isArray(value.frames)) return;
        const rtt = receivedMs - sentMs - (after - before);
        if (![rtt, before, after].every(Number.isFinite) || rtt < 0 || after < before) return;
        this.clocks.push({ rtt, offset: ((before - sentMs) + (after - receivedMs)) / 2, at: receivedMs });
        this.clocks = this.clocks.filter(clock => receivedMs - clock.at < 30000).slice(-40);
        const best = this.clocks.reduce((a, b) => a.rtt < b.rtt ? a : b);
        for (const frame of value.frames) {
            if (!Array.isArray(frame) || frame.length !== 2 || !frame.every(Number.isFinite)) continue;
            const rendered = this.rendered.get(frame[0]);
            if (rendered === undefined) continue;
            const delay = rendered - frame[1] + best.offset;
            this.rendered.delete(frame[0]);
            if (delay >= 0 && delay < 10000) this.delays.push(delay);
        }
        this.delays = this.delays.slice(-180);
    }
    metrics(): { latencyMs?: number; clockUncertaintyMs?: number } {
        if (!this.delays.length || !this.clocks.length) return {};
        if (this.clocks[this.clocks.length - 1].at - this.lastRendered > 5000) return {};
        const sorted = [...this.delays].sort((a, b) => a - b);
        const best = this.clocks.reduce((a, b) => a.rtt < b.rtt ? a : b);
        return { latencyMs: sorted[Math.floor(sorted.length / 2)], clockUncertaintyMs: best.rtt / 2 };
    }
}

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
