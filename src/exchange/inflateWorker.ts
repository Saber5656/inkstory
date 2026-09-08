import { BundleValidationError } from './bundleSchema';
import { unzipStream } from './import';

type WorkerRequest = { bytes: ArrayBuffer };
type WorkerResponse =
  | { entries: Array<{ path: string; bytes: ArrayBuffer }> }
  | { progress: { processedBytes: number; totalBytes: number } }
  | { error: { path: string; message: string } };
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
};

scope.onmessage = (event) => {
  void unzipStream(
    new Uint8Array(event.data.bytes),
    (processedBytes, totalBytes) => {
      scope.postMessage({ progress: { processedBytes, totalBytes } });
    },
  ).then(
    (entries) => {
      const payload = [...entries].map(([path, bytes]) => ({
        path,
        bytes: bytes.buffer as ArrayBuffer,
      }));
      scope.postMessage(
        { entries: payload },
        payload.map((entry) => entry.bytes),
      );
    },
    (error: unknown) => {
      if (error instanceof BundleValidationError) {
        scope.postMessage({
          error: {
            path: error.path,
            message: error.message.slice(error.path.length + 2),
          },
        });
        return;
      }
      scope.postMessage({
        error: {
          path: 'bundle',
          message: error instanceof Error ? error.message : 'inflate failed',
        },
      });
    },
  );
};
