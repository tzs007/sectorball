export type Throttled<T> = { call(v: T): void; flush(): void; cancel(): void };

/** Leading call, then at most one per interval; the last value is emitted as a trailing call. */
export const throttle = <T>(
  fn: (v: T) => void,
  intervalMs: number,
  now: () => number = () => Date.now(),
): Throttled<T> => {
  let lastEmit = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const emit = (value: T): void => {
    lastEmit = now();
    fn(value);
  };

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = (): void => {
    clearTimer();
    if (pending === null) return;
    const { value } = pending;
    pending = null;
    emit(value);
  };

  return {
    call(value) {
      const wait = lastEmit + intervalMs - now();
      if (wait <= 0 && timer === null) {
        emit(value);
        return;
      }
      pending = { value };
      timer ??= setTimeout(flush, Math.max(0, wait));
    },
    flush,
    cancel() {
      clearTimer();
      pending = null;
    },
  };
};
