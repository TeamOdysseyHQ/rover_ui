import type { OpticalFlowResult } from './opticalFlowProcessor';
import type { FlowRequest, FlowResponse } from './opticalFlowProtocol';
export type { OpticalFlowResult } from './opticalFlowProcessor';

type FlowState = {
    id: string;
    cameraName: string;
    video: HTMLVideoElement;
    running: boolean;
    epoch: number;
    lastTimestamp: number;
    callbackId: number | null;
    visibility: () => void;
    onResult?: (result: OpticalFlowResult) => void;
    fail: (error: Error) => void;
};
type FrameJob = { frameId: number; state: FlowState; epoch: number };
const errorValue = (error: unknown) => error instanceof Error ? error : new Error(String(error));

/** One runtime and one frame in flight across every enabled camera in this tab. */
class FlowWorker {
    readonly worker: Worker;
    readonly ready: Promise<void>;
    readonly owners = new Set<object>();
    readonly states = new Set<FlowState>();
    closed = false;
    initialized = false;
    private job: FrameJob | null = null;
    private serial = 0;
    private resolveReady!: () => void;
    private rejectReady!: (error: Error) => void;
    private timeout: ReturnType<typeof setTimeout>;

    constructor() {
        this.worker = new Worker(new URL('./opticalFlow.worker.ts', import.meta.url), { type: 'module', name: 'rover-optical-flow' });
        this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
        this.timeout = setTimeout(() => this.fail(new Error('Optical-flow initialization timed out')), 10000);
        this.worker.onmessage = ({ data }: MessageEvent<FlowResponse>) => {
            if (this.closed) return;
            switch (data.type) {
                case 'ready':
                    clearTimeout(this.timeout);
                    this.initialized = true;
                    this.resolveReady();
                    break;
                case 'init-error':
                    this.fail(new Error(data.message));
                    break;
                case 'frame-error':
                case 'result': {
                    const job = this.job;
                    if (!job || job.frameId !== data.frameId) return;
                    this.job = null;
                    if (!job.state.running || job.state.epoch !== job.epoch || document.hidden) return;
                    if (data.type === 'frame-error') job.state.fail(new Error(data.message));
                    else if (data.result) {
                        try { job.state.onResult?.({ ...data.result, cameraName: job.state.cameraName }); }
                        catch (error) { job.state.fail(errorValue(error)); }
                    }
                    break;
                }
                default: {
                    const unhandled: never = data;
                    throw new Error(`Unsupported optical-flow reply: ${unhandled}`);
                }
            }
        };
        this.worker.onerror = event => this.fail(new Error(event.message || 'Optical-flow worker failed'));
        this.worker.onmessageerror = () => this.fail(new Error('Optical-flow worker message failed'));
        this.post({ type: 'init' });
    }

    post(message: FlowRequest, transfer: Transferable[] = []): void {
        if (!this.closed) this.worker.postMessage(message, transfer);
    }

    submit(state: FlowState, mediaTime: number): void {
        if (this.closed || this.job) return; // Drop analysis samples; never queue old video frames.
        const job = { frameId: ++this.serial, state, epoch: state.epoch };
        this.job = job;
        state.lastTimestamp = mediaTime;
        const capture = async (): Promise<VideoFrame | ImageBitmap> => typeof VideoFrame === 'function'
            ? new VideoFrame(state.video) : createImageBitmap(state.video);
        void capture().then(frame => {
            if (this.closed || !state.running || state.epoch !== job.epoch || document.hidden) {
                frame.close();
                if (this.job === job) this.job = null;
                return;
            }
            try {
                this.post({ type: 'frame', id: state.id, frameId: job.frameId, mediaTime, frame }, [frame]);
            } catch (error) {
                frame.close();
                throw error;
            }
        }).catch(error => {
            if (this.job === job) this.job = null;
            if (state.running && state.epoch === job.epoch) state.fail(errorValue(error));
        });
    }

    dispose(): void {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.timeout);
        this.rejectReady(new DOMException('Optical flow stopped', 'AbortError'));
        this.job = null;
        this.worker.terminate();
    }

    private fail(error: Error): void {
        this.rejectReady(error);
        this.dispose();
        for (const state of [...this.states]) state.fail(error);
    }
}

let sharedWorker: FlowWorker | null = null;
let sessionSequence = 0;

export class OpticalFlowService {
    private runtime: FlowWorker | null = null;
    private readonly states = new Map<string, FlowState>();

    async initialize(): Promise<void> {
        if (this.runtime && !this.runtime.closed) return this.runtime.ready;
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || (typeof VideoFrame !== 'function' && typeof createImageBitmap !== 'function')) {
            throw new Error('Optical flow requires workers, OffscreenCanvas, and transferable video frames or image bitmaps');
        }
        if (!sharedWorker || sharedWorker.closed) sharedWorker = new FlowWorker();
        const runtime = sharedWorker;
        this.runtime = runtime;
        runtime.owners.add(this);
        try { await runtime.ready; }
        catch (error) { if (this.runtime === runtime) this.stopAll(); throw error; }
    }

    isReady(): boolean { return !!this.runtime?.initialized && !this.runtime.closed; }

    start(cameraName: string, video: HTMLVideoElement, onResult?: (result: OpticalFlowResult) => void, onError?: (error: Error) => void): void {
        const runtime = this.runtime;
        if (!runtime?.initialized || runtime.closed) throw new Error('Initialize optical flow before starting');
        if (this.states.has(cameraName)) return;
        if (typeof video.requestVideoFrameCallback !== 'function') throw new Error('Optical flow requires requestVideoFrameCallback');
        const state: FlowState = {
            id: `flow-${++sessionSequence}`, cameraName, video, running: true, epoch: 0,
            lastTimestamp: -Infinity, callbackId: null, onResult,
            visibility: () => {
                if (document.hidden) {
                    state.epoch++;
                    state.lastTimestamp = -Infinity;
                    runtime.post({ type: 'reset', id: state.id });
                }
            },
            fail: error => { this.stop(cameraName); onError?.(error); }
        };
        this.states.set(cameraName, state);
        runtime.states.add(state);
        document.addEventListener('visibilitychange', state.visibility);
        const next = (_now: number, metadata: VideoFrameCallbackMetadata) => {
            state.callbackId = null;
            if (!state.running) return;
            if (!document.hidden && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 &&
                (metadata.mediaTime < state.lastTimestamp || metadata.mediaTime - state.lastTimestamp >= 1 / 15)) {
                runtime.submit(state, metadata.mediaTime);
            }
            if (state.running) state.callbackId = video.requestVideoFrameCallback(next);
        };
        state.callbackId = video.requestVideoFrameCallback(next);
    }

    stop(cameraName: string): void {
        const state = this.states.get(cameraName);
        if (!state) return;
        state.running = false;
        if (state.callbackId !== null) state.video.cancelVideoFrameCallback(state.callbackId);
        document.removeEventListener('visibilitychange', state.visibility);
        this.runtime?.post({ type: 'reset', id: state.id });
        this.runtime?.states.delete(state);
        this.states.delete(cameraName);
        if (!this.states.size) this.releaseWorker();
    }

    stopAll(): void {
        for (const name of this.states.keys()) this.stop(name);
        this.releaseWorker();
    }

    private releaseWorker(): void {
        const runtime = this.runtime;
        if (!runtime) return;
        this.runtime = null;
        runtime.owners.delete(this);
        if (!runtime.owners.size) {
            runtime.dispose();
            if (sharedWorker === runtime) sharedWorker = null;
        }
    }
}
