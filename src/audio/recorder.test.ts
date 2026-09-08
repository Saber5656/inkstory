import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRecording } from './recorder';
const stopTrack = vi.fn();
class Recorder extends EventTarget {
  static isTypeSupported(mime: string) {
    return mime === 'audio/webm;codecs=opus';
  }
  state = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.dispatchEvent(
      Object.assign(new Event('dataavailable'), {
        data: new Blob(['voice'], { type: this.mimeType }),
      }),
    );
    this.dispatchEvent(new Event('stop'));
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('microphone lifecycle', () => {
  it('captures the supported container and stops every track', async () => {
    vi.stubGlobal('MediaRecorder', Recorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    const session = await startRecording();
    const result = await session.stop();
    expect(result.mimeType).toBe('audio/webm;codecs=opus');
    expect(result.blob.size).toBe(5);
    expect(stopTrack).toHaveBeenCalled();
  });
  it('stops automatically at sixty seconds and cancels safely', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', Recorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    const session = await startRecording();
    await vi.advanceTimersByTimeAsync(60000);
    expect((await session.result).durationMs).toBe(60000);
    session.cancel();
  });
  it('releases acquired tracks when recorder construction fails', async () => {
    class Broken extends Recorder {
      constructor() {
        super();
        throw new Error('codec');
      }
    }
    vi.stubGlobal('MediaRecorder', Broken);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
      },
    });
    await expect(startRecording()).rejects.toThrow('codec');
    expect(stopTrack).toHaveBeenCalled();
  });
});
