import type { OpticalFlowResult } from './opticalFlowProcessor';

type Extra = { camera: string; fps?: number; width?: number; height?: number };
let pending: object[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** Development builds only: batch flow summaries to the dev server's /api/dev/flow-log. */
export function devFlowLog(result: OpticalFlowResult, extra: Extra): void {
    if (!import.meta.env.DEV) return;
    pending.push({
        at: Date.now(), ...extra, frame: result.frameCount, n: result.trackedPoints,
        dx: +result.meanDx.toFixed(3), dy: +result.meanDy.toFixed(3),
        bandDy: [result.topMeanDy, result.middleMeanDy, result.bottomMeanDy].map(v => v === null ? null : +v.toFixed(3)),
        bandN: [result.topPoints, result.middlePoints, result.bottomPoints],
        dt: +result.deltaTime.toFixed(4)
    });
    timer ??= setTimeout(() => {
        timer = undefined;
        const body = JSON.stringify(pending);
        pending = [];
        void fetch('/api/dev/flow-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    }, 1000);
}
