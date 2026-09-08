export function createAutosave<T>(
  write: (value: T) => Promise<unknown>,
  onError: (error: unknown) => void = console.error,
) {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const flush = (): Promise<unknown> => {
    clearTimeout(timer);
    const next = pending;
    pending = undefined;
    if (next)
      queue = queue.catch(() => undefined).then(() => write(next.value));
    return queue;
  };
  return {
    schedule(value: T) {
      pending = { value };
      clearTimeout(timer);
      timer = setTimeout(() => {
        void flush().catch(onError);
      }, 500);
    },
    flush,
    hasPending: () => !!pending,
  };
}
