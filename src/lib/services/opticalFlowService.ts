// Shared across panel instances; load the UMD runtime as a local asset rather than
// feeding the 13 MB generated Emscripten code through Rollup's CommonJS parser.
let browserRuntime: Promise<any> | null = null;

function loadBrowserRuntime(): Promise<any> {
    if (!browserRuntime) {
        browserRuntime = (async () => {
            const { default: url } = await import('@techstark/opencv-js/dist/opencv.js?url');
            return new Promise<any>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = () => {
                    const runtime = (window as typeof window & { cv?: any }).cv;
                    if (!runtime) reject(new Error('OpenCV runtime was not exported'));
                    else Promise.resolve(runtime).then(resolve, reject);
                };
                script.onerror = () => {
                    script.remove();
                    reject(new Error('Could not load the OpenCV runtime'));
                };
                document.head.appendChild(script);
            });
        })().catch(error => {
            browserRuntime = null;
            throw error;
        });
    }
    return browserRuntime;
}

interface FlowPoint {
    x: number;
    y: number;
    dx: number;
    dy: number;
}

interface CameraFlowState {
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    previousGray: any | null;
    previousPoints: any | null;

    running: boolean;
    frameCount: number;
    lastTimestamp: number;
    callbackId: number | null;
}

export interface OpticalFlowResult {
    cameraName: string;

    frameCount: number;
    trackedPoints: number;

    meanDx: number;
    meanDy: number;

    meanMagnitude: number;

    // null means the band had no accepted tracks, rather than measured zero motion.
    topMeanDy: number | null;
    middleMeanDy: number | null;
    bottomMeanDy: number | null;
    topPoints: number;
    middlePoints: number;
    bottomPoints: number;
    mediaTime: number;
    deltaTime: number;

    points: FlowPoint[];
}

export class OpticalFlowService {
    private cv: any = null;

    private readonly processingWidth = 320;
    private readonly processingHeight = 240;

    private readonly states = new Map<string, CameraFlowState>();

    private initializing: Promise<void> | null = null;

    /** Load the large browser runtime only when diagnostics are requested. */
    initialize(): Promise<void> {
        if (this.isReady()) return Promise.resolve();
        if (this.initializing) return this.initializing;
        this.initializing = this.loadOpenCV().finally(() => {
            this.initializing = null;
        });
        return this.initializing;
    }

    private async loadOpenCV(): Promise<void> {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            const ready = async () => {
                const cv = await loadBrowserRuntime();
                if (!cv.Mat) {
                    await new Promise<void>(resolve => {
                        const previous = cv.onRuntimeInitialized;
                        cv.onRuntimeInitialized = () => {
                            previous?.();
                            resolve();
                        };
                    });
                }
                if (!cv.Mat) throw new Error('OpenCV cv.Mat is unavailable');
                return cv;
            };
            this.cv = await Promise.race([
                ready(),
                new Promise<never>((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('OpenCV initialization timed out')), 10000);
                })
            ]);
        } finally {
            clearTimeout(timeout);
        }
    }

    isReady(): boolean { return !!this.cv?.Mat; }

    getCV(): any {
        if (!this.isReady()) throw new Error('Initialize OpenCV before starting optical flow');
        return this.cv;
    }

    start(cameraName: string, video: HTMLVideoElement, onResult?: (result: OpticalFlowResult) => void): void {
        this.getCV();
        if (this.states.has(cameraName)) return;
        if (typeof video.requestVideoFrameCallback !== 'function') {
            throw new Error('Optical flow requires requestVideoFrameCallback');
        }
        const canvas = document.createElement('canvas');
        canvas.width = this.processingWidth;
        canvas.height = this.processingHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not create optical-flow canvas');
        const state: CameraFlowState = {
            video, canvas, ctx, previousGray: null, previousPoints: null,
            running: true, frameCount: 0, lastTimestamp: 0, callbackId: null
        };
        this.states.set(cameraName, state);
        const next = (_now: number, metadata: VideoFrameCallbackMetadata) => {
            state.callbackId = null;
            if (!state.running) return;
            // Diagnostics must not spend CPU in a hidden tab or monopolize high-FPS streams.
            if (document.hidden) this.releaseState(state);
            else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 &&
                video.videoHeight > 0 && (!state.previousGray || metadata.mediaTime < state.lastTimestamp ||
                    metadata.mediaTime - state.lastTimestamp >= 1 / 15)) {
                try {
                    const result = this.processFrame(cameraName, state, metadata.mediaTime);
                    if (result) onResult?.(result);
                } catch (error) {
                    this.releaseState(state);
                    console.error(`[OpticalFlow] Processing failed (${cameraName}):`, error);
                }
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
        this.releaseState(state);
        this.states.delete(cameraName);
    }

    stopAll(): void {
        for (const cameraName of this.states.keys()) this.stop(cameraName);
    }

    private processFrame(
        cameraName: string,
        state: CameraFlowState,
        mediaTime: number
    ): OpticalFlowResult | null {
        const cv = this.getCV();

        // Ignore repeated or reordered frames; disjoint media timelines need fresh features.
        if (state.previousGray && mediaTime === state.lastTimestamp) return null;
        if (state.previousGray && (mediaTime < state.lastTimestamp || mediaTime - state.lastTimestamp > 0.5)) {
            this.releaseState(state);
        }
        const deltaTime = mediaTime - state.lastTimestamp;
        state.frameCount++;
        state.lastTimestamp = mediaTime;

        // Copy the WebRTC video frame into the reduced-resolution canvas.
        state.ctx.drawImage(state.video, 0, 0, this.processingWidth, this.processingHeight);

        const imageData = state.ctx.getImageData(0, 0, this.processingWidth, this.processingHeight);

        // Every native allocation must be released, including on OpenCV errors.
        const resources = new Set<any>();
        const own = (value: any) => { resources.add(value); return value; };
        try {
            const rgba = own(cv.matFromImageData(imageData));
            const gray = own(new cv.Mat());
            cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);

            // First frame, or no usable features:
            // detect features but cannot calculate motion yet.
            if (!state.previousGray || !state.previousPoints || state.previousPoints.rows === 0) {
                this.releaseState(state);
                const points = this.detectFeatures(gray);

                state.previousGray = gray;
                resources.delete(gray);
                state.previousPoints = points;

                return null;
            }

            const nextPoints = own(new cv.Mat());
            const status = own(new cv.Mat());
            const error = own(new cv.Mat());
            const backwardPoints = own(new cv.Mat());
            const backwardStatus = own(new cv.Mat());
            const backwardError = own(new cv.Mat());
            const winSize = new cv.Size(21, 21);
            const maxLevel = 3;
            const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 30, 0.01);

            cv.calcOpticalFlowPyrLK(state.previousGray, gray, state.previousPoints,
                nextPoints, status, error, winSize, maxLevel, criteria);
            // Track backwards to reject points that do not return to their original position.
            cv.calcOpticalFlowPyrLK(gray, state.previousGray, nextPoints,
                backwardPoints, backwardStatus, backwardError, winSize, maxLevel, criteria);

            const points: FlowPoint[] = [];

            for (let i = 0; i < state.previousPoints.rows; i++) {
                const forwardValid = status.ucharAt(i, 0);
                const backwardValid = backwardStatus.ucharAt(i, 0);

                if (!forwardValid || !backwardValid) {
                    continue;
                }

                const oldX = state.previousPoints.floatAt(i, 0);
                const oldY = state.previousPoints.floatAt(i, 1);
                const newX = nextPoints.floatAt(i, 0);
                const newY = nextPoints.floatAt(i, 1);
                const backX = backwardPoints.floatAt(i, 0);
                const backY = backwardPoints.floatAt(i, 1);

                // Forward-backward tracking error.
                const fbDx = oldX - backX;
                const fbDy = oldY - backY;
                const fbError = Math.sqrt(fbDx * fbDx + fbDy * fbDy);

                // Reject unreliable tracks.
                if (!Number.isFinite(fbError) || fbError > 1.5) {
                    continue;
                }

                const dx = newX - oldX;
                const dy = newY - oldY;
                const magnitude = Math.sqrt(dx * dx + dy * dy);

                if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
                    continue;
                }

                if (newX < 0 || newX >= this.processingWidth ||
                    newY < 0 || newY >= this.processingHeight || magnitude > 50) {
                    continue;
                }

                points.push({ x: newX, y: newY, dx, dy });
            }
            // Reject motion outliers using median absolute deviation.

            const dxValues = points.map(point => point.dx);
            const dyValues = points.map(point => point.dy);
            const medianDx = this.median(dxValues);
            const medianDy = this.median(dyValues);
            const madDx = this.medianAbsoluteDeviation(dxValues, medianDx);
            const madDy = this.medianAbsoluteDeviation(dyValues, medianDy);
            const robustDxThreshold = Math.max(3 * madDx, 1.0);
            const robustDyThreshold = Math.max(3 * madDy, 1.0);
            const filteredPoints = points.filter(point =>
                Math.abs(point.dx - medianDx) <= robustDxThreshold &&
                Math.abs(point.dy - medianDy) <= robustDyThreshold);

            const detectedCandidatePoints = points.length;
            const trackedPoints = filteredPoints.length;
            const totalDetectedPoints = state.previousPoints.rows;
            const trackingRetention = totalDetectedPoints > 0 ? trackedPoints / totalDetectedPoints : 0;
            const robustRetention = detectedCandidatePoints > 0 ? trackedPoints / detectedCandidatePoints : 0;

            if (state.frameCount % 30 === 0) {
                console.debug('[OpticalFlow] Tracking quality:', {
                    detected: totalDetectedPoints, fbAccepted: detectedCandidatePoints,
                    robustAccepted: trackedPoints,
                    fbRetention: totalDetectedPoints ? detectedCandidatePoints / totalDetectedPoints : 0,
                    trackingRetention, robustRetention
                });
            }

            const bands: number[][] = [[], [], []];
            let totalDx = 0, totalDy = 0, totalMagnitude = 0;
            for (const point of filteredPoints) {
                totalDx += point.dx;
                totalDy += point.dy;
                totalMagnitude += Math.hypot(point.dx, point.dy);
                bands[Math.min(2, Math.floor(point.y * 3 / this.processingHeight))].push(point.dy);
            }
            const [topDy, middleDy, bottomDy] = bands;
            const meanDx = trackedPoints ? totalDx / trackedPoints : 0;
            const meanDy = trackedPoints ? totalDy / trackedPoints : 0;
            const meanMagnitude = trackedPoints ? totalMagnitude / trackedPoints : 0;
            const result: OpticalFlowResult = {
                cameraName,
                frameCount: state.frameCount,
                trackedPoints,
                meanDx,
                meanDy,
                meanMagnitude,
                topMeanDy: this.mean(topDy),
                middleMeanDy: this.mean(middleDy),
                bottomMeanDy: this.mean(bottomDy),
                topPoints: topDy.length,
                middlePoints: middleDy.length,
                bottomPoints: bottomDy.length,
                mediaTime,
                deltaTime,
                points: filteredPoints
            };

            // Never seed the next LK pass with rejected/out-of-bounds tracks.
            const referencePoints = own(
                state.frameCount % 30 === 0 || trackedPoints < 30
                    ? this.detectFeatures(gray)
                    : cv.matFromArray(trackedPoints, 1, cv.CV_32FC2,
                        filteredPoints.flatMap(point => [point.x, point.y]))
            );
            this.releaseState(state);
            state.previousGray = gray;
            state.previousPoints = referencePoints;
            resources.delete(gray);
            resources.delete(referencePoints);
            return result;
        } finally {
            for (const resource of resources) resource.delete();
        }
    }

    /**
     * Detect good features for Lucas-Kanade tracking.
     */
    private detectFeatures(gray: any): any {
        const cv = this.getCV();
        const detector = new cv.FastFeatureDetector(
            5,      // lower threshold
            true,   // non-max suppression
            cv.FastFeatureDetector_TYPE_9_16
        );

        const keypoints = new cv.KeyPointVector();

        try {
            detector.detect(gray, keypoints);

            const count = keypoints.size();

            if (!count) return new cv.Mat();

            // Bound LK work on highly textured frames. Strongest corners first.
            const selected = Array.from({ length: count }, (_, i) => keypoints.get(i))
                .filter(point => point.pt.x >= 8 && point.pt.y >= 8 &&
                    point.pt.x < this.processingWidth - 8 && point.pt.y < this.processingHeight - 8)
                .sort((a, b) => b.response - a.response)
                .slice(0, 240);
            const points = new cv.Mat(selected.length, 1, cv.CV_32FC2);
            const data = points.data32F;

            for (let i = 0; i < selected.length; i++) {
                const keypoint = selected[i];

                data[i * 2] = keypoint.pt.x;
                data[i * 2 + 1] = keypoint.pt.y;
            }

            return points;
        } finally {
            keypoints.delete();
            detector.delete();
        }
    }

    private median(values: number[]): number {
        if (!values.length) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    private medianAbsoluteDeviation(values: number[], median: number): number {
        return this.median(values.map(value => Math.abs(value - median)));
    }

    private mean(values: number[]): number | null {
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    }

    private releaseState(state: CameraFlowState): void {
        state.previousGray?.delete();
        state.previousPoints?.delete();
        state.previousGray = null;
        state.previousPoints = null;
    }
}
