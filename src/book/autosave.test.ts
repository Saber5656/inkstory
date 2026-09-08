import { describe, expect, it, vi } from 'vitest';
import { createAutosave } from './autosave';
describe('autosave queue', () => {
  it('coalesces changes and flushes before leaving', async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue(undefined);
    const save = createAutosave(write);
    save.schedule({ text: 'one' });
    save.schedule({ text: 'two' });
    expect(write).not.toHaveBeenCalled();
    await save.flush();
    expect(write).toHaveBeenCalledExactlyOnceWith({ text: 'two' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('serializes writes so a slow save cannot overwrite a newer edit', async () => {
    const values: string[] = [];
    const write = async (value: string) => {
      await Promise.resolve();
      values.push(value);
    };
    const save = createAutosave(write);
    save.schedule('old');
    const a = save.flush();
    save.schedule('new');
    const b = save.flush();
    await Promise.all([a, b]);
    expect(values).toEqual(['old', 'new']);
  });
});
