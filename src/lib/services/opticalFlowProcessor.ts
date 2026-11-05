import type { Mat, KeyPointVector } from '@techstark/opencv-js';

const functions = ['Mat', 'matFromImageData', 'matFromArray', 'cvtColor',
    'calcOpticalFlowPyrLK', 'KeyPointVector', 'Size', 'TermCriteria'] satisfies (keyof typeof import('@techstark/opencv-js'))[];
const constants = ['COLOR_RGBA2GRAY', 'CV_32FC2'] satisfies (keyof typeof import('@techstark/opencv-js'))[];

// The published definitions omit these bindings, which the bundled runtime exports.
export type CvRuntime = Pick<typeof import('@techstark/opencv-js'), typeof functions[number] | typeof constants[number]> & {
    FastFeatureDetector: new (threshold: number, nonmax: boolean, type: number) => {
        detect(gray: Mat, points: KeyPointVector): void;
        delete(): void;
    };
    FastFeatureDetector_TYPE_9_16: number;
    TermCriteria_EPS: number;
    TermCriteria_COUNT: number;
};

/** Check the bindings used by this processor at the generated-runtime boundary. */
export function isCvRuntime(value: unknown): value is CvRuntime {
    if (!value || typeof value !== 'object') return false;
    return [...functions, 'FastFeatureDetector'].every(name => typeof Reflect.get(value, name) === 'function') &&
        [...constants, 'FastFeatureDetector_TYPE_9_16', 'TermCriteria_EPS', 'TermCriteria_COUNT']
            .every(name => typeof Reflect.get(value, name) === 'number');
}

export interface FlowPoint {
    x: number;
    y: number;
    dx: number;
    dy: number;
}

interface CameraFlowState {
    previousGray: Mat | null;
    previousPoints: Mat | null;
    frameCount: number;
    lastTimestamp: number;
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

export class OpticalFlowProcessor {
    private readonly processingWidth = 320;
    private readonly processingHeight = 240;
    private readonly states = new Map<string, CameraFlowState>();

    private cv: CvRuntime;
    constructor(cv: CvRuntime) { this.cv = cv; }

    stop(cameraName: string): void {
        const state = this.states.get(cameraName);
        if (state) this.releaseState(state);
        this.states.delete(cameraName);
    }

    stopAll(): void {
        for (const name of this.states.keys()) this.stop(name);
    }

    processFrame(
        cameraName: string,
        imageData: ImageData,
        mediaTime: number
    ): OpticalFlowResult | null {
        const cv = this.cv;

        let state = this.states.get(cameraName);
        if (!state) {
            state = { previousGray: null, previousPoints: null, frameCount: 0, lastTimestamp: 0 };
            this.states.set(cameraName, state);
        }

        // Ignore repeated or reordered frames; disjoint media timelines need fresh features.
        if (state.previousGray && mediaTime === state.lastTimestamp) return null;
        if (state.previousGray && (mediaTime < state.lastTimestamp || mediaTime - state.lastTimestamp > 0.5)) {
            this.releaseState(state);
        }
        const deltaTime = mediaTime - state.lastTimestamp;
        state.frameCount++;
        state.lastTimestamp = mediaTime;

        // Every native allocation must be released, including on OpenCV errors.
        const resources = new Set<{ delete(): void }>();
        const own = <T extends { delete(): void }>(value: T): T => { resources.add(value); return value; };
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
            const criteria = new cv.TermCriteria(cv.TermCriteria_EPS | cv.TermCriteria_COUNT, 30, 0.01);

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

            const trackedPoints = filteredPoints.length;

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
                // Re-detect when any third of the image runs short of tracks; readout
                // estimation compares top, middle and bottom bands.
                state.frameCount % 30 === 0 || trackedPoints < 30 || bands.some(band => band.length < 8)
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
    private detectFeatures(gray: Mat): Mat {
        const cv = this.cv;
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

            // Bound LK work on highly textured frames, but spread it over a grid: the strongest
            // corners cluster on one textured object and leave image bands with no tracks.
            const columns = 8, rows = 6, perCell = 5;
            const cells = new Map<number, ReturnType<typeof keypoints.get>[]>();
            for (let i = 0; i < count; i++) {
                const point = keypoints.get(i);
                if (point.pt.x < 8 || point.pt.y < 8 ||
                    point.pt.x >= this.processingWidth - 8 || point.pt.y >= this.processingHeight - 8) continue;
                const cell = Math.floor(point.pt.y * rows / this.processingHeight) * columns +
                    Math.floor(point.pt.x * columns / this.processingWidth);
                const list = cells.get(cell);
                if (list) list.push(point); else cells.set(cell, [point]);
            }
            const selected = [...cells.values()].flatMap(list =>
                list.sort((a, b) => b.response - a.response).slice(0, perCell));
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
