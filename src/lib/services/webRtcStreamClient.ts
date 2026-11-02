import { FrameLatencySampler, WebRtcStatsSampler, type WebRtcMetrics } from './webRtcMetrics.ts';
export type { WebRtcMetrics } from './webRtcMetrics.ts';
export const WEBRTC_TARGET_FPS = 60;

type WebRtcState = 'disconnected' | 'connecting' | 'connected' | 'error';
type StreamError = Error & { status?: number };
type Session = {
	pc: RTCPeerConnection;
	video: HTMLVideoElement;
	controller: AbortController;
	stream: MediaStream | null;
	deleteUrl: string | null;
	established: boolean;
	metricsTimer?: ReturnType<typeof setTimeout>;
	disconnectTimer?: ReturnType<typeof setTimeout>;
	timingChannel?: RTCDataChannel;
	timingTimer?: ReturnType<typeof setTimeout>;
	frameCallback?: number;
	latency: FrameLatencySampler;
	targetFps: number;
	scale: number;
};

function errorMessage(status: number): string {
	switch (status) {
		case 400: return 'Camera not started — click Start first';
		case 404: return 'Camera not found';
		case 429: return 'Viewer capacity reached. Close another camera view.';
		case 503: return 'ROS not connected';
		default: return `WebRTC negotiation failed (HTTP ${status})`;
	}
}

// Bound native WebRTC promises as well as fetch. Cancellation must not wait
// for ICE gathering or a pending SDP operation to finish.
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

function waitForPeer(pc: RTCPeerConnection, event: string, ready: () => boolean, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			pc.removeEventListener(event, check);
			signal.removeEventListener('abort', abort);
		};
		const abort = () => { cleanup(); reject(signal.reason); };
		const check = () => {
			if (signal.aborted) abort();
			else if (ready()) { cleanup(); resolve(); }
		};
		pc.addEventListener(event, check);
		signal.addEventListener('abort', abort, { once: true });
		check();
	});
}

export class WebRtcStreamClient {
	private session: Session | null = null;
	private state: WebRtcState = 'disconnected';
	private timeoutMs: number;
	private onStateChangeCallback: ((state: WebRtcState) => void) | null = null;
	private onErrorCallback: ((err: StreamError) => void) | null = null;
	private onMetricsCallback: ((metrics: WebRtcMetrics) => void) | null = null;

	constructor(timeoutMs = 20000) { this.timeoutMs = timeoutMs; }
	onStateChange(cb: (state: WebRtcState) => void): void { this.onStateChangeCallback = cb; }
	onError(cb: (err: StreamError) => void): void { this.onErrorCallback = cb; }
	onMetrics(cb: (metrics: WebRtcMetrics) => void): void { this.onMetricsCallback = cb; }
	getState(): WebRtcState { return this.state; }

	private setState(state: WebRtcState): void {
		if (this.state === state) return;
		this.state = state;
		this.onStateChangeCallback?.(state);
	}

	private async release(session: Session): Promise<void> {
		if (session.metricsTimer) clearTimeout(session.metricsTimer);
		if (session.timingTimer) clearTimeout(session.timingTimer);
        if (session.timingChannel) { session.timingChannel.onmessage = null; session.timingChannel.onopen = null; session.timingChannel.close(); }
		if (session.frameCallback !== undefined) session.video.cancelVideoFrameCallback(session.frameCallback);
		if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
		session.pc.ontrack = null;
		session.pc.onconnectionstatechange = null;
		session.pc.close();
		if (session.stream && session.video.srcObject === session.stream) session.video.srcObject = null;
		const deleteUrl = session.deleteUrl;
		session.deleteUrl = null;
		// Old servers do not return a peer ID. Closing the local peer lets ICE
		// clean it up there; NEVER fall back to the legacy close-all endpoint.
		if (!deleteUrl) return;
		try {
			const response = await fetch(deleteUrl, { method: 'DELETE', signal: AbortSignal.timeout(5000) });
			if (!response.ok) console.warn(`[WebRTC] Peer cleanup returned HTTP ${response.status}`);
		} catch (error) { console.warn('[WebRTC] Peer cleanup failed:', error); }
	}

	/** Receive video; resolve only when ICE/DTLS actually connects. */
	async connect(offerUrl: string, video: HTMLVideoElement, fps = WEBRTC_TARGET_FPS): Promise<void> {
		if (this.session) return;
		this.setState('connecting');
		const controller = new AbortController();
		const signal = controller.signal;
		const timer = setTimeout(() => controller.abort(new DOMException('WebRTC connection timed out', 'TimeoutError')), this.timeoutMs);
		let session: Session | null = null;
		try {
			const pc = new RTCPeerConnection({ iceServers: [] });
			session = { pc, video, controller, stream: null, deleteUrl: null, established: false, targetFps: fps, scale: 1, latency: new FrameLatencySampler() };
			this.session = session;
			const current = session;
			pc.ontrack = (event) => {
				if (this.session !== current || signal.aborted) return;
				current.stream = event.streams?.[0] ?? new MediaStream([event.track]);
				video.srcObject = current.stream;
			};
			pc.onconnectionstatechange = () => {
				if (this.session !== current) return;
				if (pc.connectionState === 'connected') {
					if (current.disconnectTimer) clearTimeout(current.disconnectTimer);
					current.disconnectTimer = undefined;
					this.setState('connected');
				}
				else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
					const error = new Error(`WebRTC transport ${pc.connectionState}`);
					controller.abort(error);
					if (current.established) {
						this.session = null;
						this.setState('error');
						void this.release(current);
						this.onErrorCallback?.(error);
					}
				} else if (pc.connectionState === 'disconnected') {
					this.setState('disconnected');
					if (current.established && !current.disconnectTimer) {
						current.disconnectTimer = setTimeout(() => {
							if (this.session !== current || pc.connectionState !== 'disconnected') return;
							const error = new Error('WebRTC transport disconnected for 5 seconds');
							controller.abort(error);
							this.session = null;
							this.setState('error');
							void this.release(current);
							this.onErrorCallback?.(error);
						}, 5000);
					}
				}
			};

            if (typeof pc.createDataChannel === 'function') current.timingChannel = pc.createDataChannel('timing', { ordered: false, maxRetransmits: 0 });
			const transceiver = pc.addTransceiver('video', { direction: 'recvonly' });
            if (typeof RTCRtpReceiver !== 'undefined' && transceiver?.setCodecPreferences) {
                const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs.filter(codec => codec.mimeType.toLowerCase() === 'video/h264');
                if (!codecs?.length) throw new Error('This browser does not support H.264 video');
                transceiver.setCodecPreferences(codecs);
                // Use the browser's supported zero-buffer target rather than its default playout delay.
                if ('jitterBufferTarget' in transceiver.receiver) transceiver.receiver.jitterBufferTarget = 0;
                if ('playoutDelayHint' in transceiver.receiver) Reflect.set(transceiver.receiver, 'playoutDelayHint', 0);
            }
			const offer = await abortable(pc.createOffer(), signal);
			signal.throwIfAborted();
			await abortable(pc.setLocalDescription(offer), signal);
			await waitForPeer(pc, 'icegatheringstatechange', () => pc.iceGatheringState === 'complete', signal);
			signal.throwIfAborted();
			const response = await abortable(fetch(offerUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sdp: pc.localDescription!.sdp, type: pc.localDescription!.type, fps }),
				signal,
			}), signal);
			const answer = await abortable(response.json().catch(() => ({})), signal);
			if (!response.ok) throw Object.assign(new Error(answer.detail ?? errorMessage(response.status)), { status: response.status });
			if (typeof answer.peer_id === 'string' && answer.peer_id) {
				const url = new URL(offerUrl);
				url.pathname = url.pathname.replace(/\/offer\/?$/, '') + '/connections/' + encodeURIComponent(answer.peer_id);
				if (typeof answer.topic === 'string') url.searchParams.set('topic_name', answer.topic);
				current.deleteUrl = url.toString();

			}
			if (Number.isFinite(answer.target_fps) && answer.target_fps > 0) current.targetFps = answer.target_fps;
			signal.throwIfAborted();
			await abortable(pc.setRemoteDescription({ type: answer.type, sdp: answer.sdp }), signal);
			await waitForPeer(pc, 'connectionstatechange', () => pc.connectionState === 'connected', signal);
			signal.throwIfAborted();
			current.established = true;
			this.setState('connected');
			this.startMetrics(current);
            this.startFrameTiming(current);
		} catch (reason) {
			const error = reason instanceof Error ? reason : new Error(String(reason));
			if (session) void this.release(session);
			// An intentional disconnect or replacement owns the current state.
			if (!session || this.session === session) {
				this.session = null;
				this.setState('error');
				this.onErrorCallback?.(error);
			}
			throw error;
		} finally { clearTimeout(timer); }
	}

	private startMetrics(session: Session): void {
		if (typeof session.pc.getStats !== 'function') return;
		const sampler = new WebRtcStatsSampler();
		let statsPending = false;
		const poll = async () => {
			if (this.session !== session || session.controller.signal.aborted) return;
			try {
				// getStats has no native cancellation. Do not stack native calls
				// behind a hung sample even after its timeout has expired.
				if (statsPending) return;
				statsPending = true;
				let request: Promise<RTCStatsReport>;
				try { request = session.pc.getStats(); }
				catch (error) { statsPending = false; throw error; }
				request.then(() => { statsPending = false; }, () => { statsPending = false; });
				const statsSignal = AbortSignal.any([session.controller.signal, AbortSignal.timeout(1500)]);
				const stats = await abortable(request, statsSignal);
				if (this.session !== session) return;
				const metrics = sampler.sample(stats);
				if (metrics) {
					// A slow feedback endpoint must not delay delivered-FPS updates.
					this.onMetricsCallback?.({ ...metrics, targetFps: session.targetFps, scale: session.scale, adaptiveQuality: false, ...session.latency.metrics() });

				}
			} catch (error) {
				if (!session.controller.signal.aborted) console.debug('[WebRTC] Metrics sample unavailable:', error);
			} finally {
				if (this.session === session && !session.controller.signal.aborted) session.metricsTimer = setTimeout(poll, 2000);
			}
		};
		void poll();
	}

    private startFrameTiming(session: Session): void {
        if (!session.timingChannel || typeof session.video.requestVideoFrameCallback !== 'function') return;
        const frame = (now: number, metadata: VideoFrameCallbackMetadata) => {
            if (this.session !== session || session.controller.signal.aborted) return;
            if ('rtpTimestamp' in metadata && typeof metadata.rtpTimestamp === 'number') {
                session.latency.record(metadata.rtpTimestamp, performance.timeOrigin + now);
            }
            session.frameCallback = session.video.requestVideoFrameCallback(frame);
        };
        session.frameCallback = session.video.requestVideoFrameCallback(frame);
        const channel = session.timingChannel;
        channel.onmessage = event => {
            if (this.session !== session || typeof event.data !== 'string') return;
            const received = performance.timeOrigin + performance.now();
            try {
                const value: unknown = JSON.parse(event.data);
                if (value && typeof value === 'object' && 'client_sent_ms' in value && typeof value.client_sent_ms === 'number') {
                    session.latency.sample(value, value.client_sent_ms, received);
                }
            } catch { /* A malformed diagnostic cannot interrupt video. */ }
        };
        let probes = 0;
        const ping = () => {
            if (this.session !== session || session.controller.signal.aborted || channel.readyState !== 'open') return;
            // Alternate small clock probes and frame metadata so large diagnostic replies cannot bias every clock estimate.
            if (channel.bufferedAmount < 1024) channel.send(JSON.stringify({ client_sent_ms: performance.timeOrigin + performance.now(), include_frames: probes % 2 === 1 }));
            session.timingTimer = setTimeout(ping, probes++ < 9 ? 30 : 1000);
        };
        channel.onopen = ping;
        if (channel.readyState === 'open') ping();
    }

	/** Keep the old argument for callers; cleanup uses the original peer's URL. */
	async disconnect(_legacyDeleteUrl?: string): Promise<void> {
		const session = this.session;
		this.session = null;
		this.setState('disconnected');
		if (!session) return;
		session.controller.abort(new DOMException('WebRTC connection cancelled', 'AbortError'));
		await this.release(session);
	}
}
