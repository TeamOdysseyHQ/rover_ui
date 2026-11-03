import type { OpticalFlowResult } from './opticalFlowProcessor';

export type FlowRequest =
    | { type: 'init' }
    | { type: 'frame'; id: string; frameId: number; mediaTime: number; frame: VideoFrame | ImageBitmap }
    | { type: 'reset'; id: string };

export type FlowResponse =
    | { type: 'ready' }
    | { type: 'init-error'; message: string }
    | { type: 'result'; frameId: number; result: OpticalFlowResult | null; processingMs: number }
    | { type: 'frame-error'; frameId: number; message: string };
