import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

describe('throttle', () => {
  let t = 0;
  const now = () => t;
  const advance = (ms: number) => {
    t += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    t = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits at most once per interval and keeps the last value', () => {
    const fn = vi.fn();
    const th = throttle(fn, 100, now);
    th.call(1);
    advance(10);
    th.call(2);
    advance(10);
    th.call(3);
    expect(fn.mock.calls).toEqual([[1]]);
    advance(80);
    expect(fn.mock.calls).toEqual([[1], [3]]);
  });

  it('emits again immediately after a quiet interval', () => {
    const fn = vi.fn();
    const th = throttle(fn, 100, now);
    th.call(1);
    advance(150);
    th.call(2);
    expect(fn.mock.calls).toEqual([[1], [2]]);
  });

  it('flush runs the pending trailing call immediately, once', () => {
    const fn = vi.fn();
    const th = throttle(fn, 100, now);
    th.call(1);
    th.call(2);
    th.flush();
    expect(fn.mock.calls).toEqual([[1], [2]]);
    advance(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel drops the pending trailing call', () => {
    const fn = vi.fn();
    const th = throttle(fn, 100, now);
    th.call(1);
    th.call(2);
    th.cancel();
    advance(200);
    expect(fn.mock.calls).toEqual([[1]]);
  });
});
