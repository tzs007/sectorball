import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAimDrag } from './useAimDrag';

const from = { x: 100, y: 100 };

const setup = () => {
  const onShoot = vi.fn();
  const { result } = renderHook(() => useAimDrag(onShoot));
  return { onShoot, result };
};

describe('useAimDrag', () => {
  it('has no aim initially', () => {
    const { result } = setup();
    expect(result.current.aim).toBeNull();
  });

  it('start + move sets pull = pointer - from', () => {
    const { result } = setup();
    act(() => { result.current.start('home-1', from, from); });
    act(() => { result.current.move({ x: 40, y: 100 }); });
    expect(result.current.aim).toEqual({ pieceId: 'home-1', from, pull: { x: -60, y: 0 } });
  });

  it('end shoots with the pull and clears the aim', () => {
    const { onShoot, result } = setup();
    act(() => { result.current.start('home-1', from, from); });
    act(() => { result.current.move({ x: 40, y: 100 }); });
    act(() => { result.current.end(); });
    expect(onShoot).toHaveBeenCalledExactlyOnceWith('home-1', { x: -60, y: 0 });
    expect(result.current.aim).toBeNull();
  });

  it('end with a pull shorter than SHOT.minPull does not shoot', () => {
    const { onShoot, result } = setup();
    act(() => { result.current.start('home-1', from, from); });
    act(() => { result.current.move({ x: 105, y: 100 }); });
    act(() => { result.current.end(); });
    expect(onShoot).not.toHaveBeenCalled();
    expect(result.current.aim).toBeNull();
  });

  it('move without an active aim does nothing', () => {
    const { result } = setup();
    act(() => { result.current.move({ x: 40, y: 100 }); });
    expect(result.current.aim).toBeNull();
  });

  it('pointer up outside ends the aim', () => {
    const { onShoot, result } = setup();
    act(() => { result.current.start('home-1', from, from); });
    act(() => { result.current.move({ x: 40, y: 100 }); });
    act(() => { result.current.cancel(); });
    expect(onShoot).not.toHaveBeenCalled();
    expect(result.current.aim).toBeNull();
  });
});
