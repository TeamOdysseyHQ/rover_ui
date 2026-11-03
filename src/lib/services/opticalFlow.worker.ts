import { OpticalFlowProcessor, isCvRuntime } from './opticalFlowProcessor';
import type { FlowRequest, FlowResponse } from './opticalFlowProtocol';
import runtimeUrl from '@techstark/opencv-js/dist/opencv.js?url';

let processor: OpticalFlowProcessor | undefined;
const canvas = new OffscreenCanvas(320, 240);
const context = canvas.getContext('2d', { willReadFrequently: true });
const message = (value: FlowResponse) => globalThis.postMessage(value);
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

globalThis.onmessage = async ({ data }: MessageEvent<FlowRequest>) => {
    switch (data.type) {
        case 'init':
            try {
                // Import the generated UMD file as an asset. Its worker branch exports
                // globalThis.cv, avoiding Rollup parsing the large generated runtime.
                await import(/* @vite-ignore */ new URL(runtimeUrl, globalThis.location.href).href);
                const runtime: unknown = await Reflect.get(globalThis, 'cv');
                if (!isCvRuntime(runtime) || !context) throw new Error('OpenCV worker initialization failed');
                processor = new OpticalFlowProcessor(runtime);
                message({ type: 'ready' });
            } catch (error) {
                message({ type: 'init-error', message: errorText(error) });
            }
            break;
        case 'reset':
            processor?.stop(data.id);
            break;
        case 'frame':
            try {
                if (!processor || !context) throw new Error('Optical-flow worker is not ready');
                const started = performance.now();
                context.drawImage(data.frame, 0, 0, 320, 240);
                const result = processor.processFrame(data.id, context.getImageData(0, 0, 320, 240), data.mediaTime);
                message({ type: 'result', frameId: data.frameId, result, processingMs: performance.now() - started });
            } catch (error) {
                processor?.stop(data.id);
                message({ type: 'frame-error', frameId: data.frameId, message: errorText(error) });
            } finally {
                data.frame.close();
            }
            break;
        default: {
            const unhandled: never = data;
            throw new Error(`Unsupported optical-flow message: ${unhandled}`);
        }
    }
};
