export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}
export interface RecordingSession {
  stream: MediaStream;
  result: Promise<Recording>;
  stop: () => Promise<Recording>;
  cancel: () => void;
}
export async function startRecording(): Promise<RecordingSession> {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  )
    throw new Error('micUnsupported');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
  });
  const release = () => stream.getTracks().forEach((track) => track.stop());
  try {
    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus'].find((mime) =>
      MediaRecorder.isTypeSupported(mime),
    );
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    const chunks: Blob[] = [];
    const started = performance.now();
    let cancelled = false;
    const result = new Promise<Recording>((resolve, reject) => {
      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener('error', () => {
        clearTimeout(timer);
        release();
        reject(new Error('micDenied'));
      });
      recorder.addEventListener('stop', () => {
        clearTimeout(timer);
        release();
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        chunks.length = 0;
        if (cancelled) {
          resolve({ blob: new Blob(), mimeType: blob.type, durationMs: 0 });
          return;
        }
        if (blob.size > 20 * 1024 * 1024) {
          reject(new Error('Recording exceeds 20 MiB'));
          return;
        }
        resolve({
          blob,
          mimeType: blob.type,
          durationMs: Math.min(60000, performance.now() - started),
        });
      });
    });
    const stop = () => {
      if (recorder.state !== 'inactive') recorder.stop();
      return result;
    };
    recorder.start(1000);
    const timer = setTimeout(() => {
      void stop().catch(() => undefined);
    }, 60000);
    return {
      stream,
      result,
      stop,
      cancel: () => {
        cancelled = true;
        clearTimeout(timer);
        if (recorder.state !== 'inactive') recorder.stop();
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}
