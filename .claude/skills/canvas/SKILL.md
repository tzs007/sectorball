---
name: canvas
description: Use when working with the HTML5 Canvas 2D API directly — rendering loops, HiDPI scaling, resizing, drawing performance.
---

# HTML5 Canvas (2D)

Game rendering in this project uses **PixiJS v8** (start with the `pixijs` skill). Use the raw Canvas 2D API only
for small standalone needs (e.g. generating a texture on an offscreen canvas, simple DOM-side previews).

## Rules
- **HiDPI:** size the backing store by `devicePixelRatio`, keep CSS size in logical pixels, then `ctx.scale(dpr, dpr)`.
- **Resize:** use `ResizeObserver` on the container, not `window.onresize` polling. Re-apply DPR scaling after resize.
- **Loop:** one `requestAnimationFrame` loop; compute movement from the frame delta time, never assume 60 fps.
  Stop the loop when not needed (`cancelAnimationFrame`).
- **State:** wrap temporary transforms/styles in `ctx.save()` / `ctx.restore()`.
- **Performance:**
  - Batch paths: one `beginPath()` + many sub-paths + one `fill()`/`stroke()` where possible.
  - Minimise state changes (`fillStyle`, `font`, `globalAlpha`) — group draws by style.
  - Pre-render static content to an `OffscreenCanvas` / hidden canvas and `drawImage` it.
  - Redraw only what changed (dirty rects) or split static/dynamic content into separate canvases.
  - Round coordinates for crisp 1px lines (`x + 0.5`).
- Keep rendering separate from game logic: logic updates state, renderer only reads state.

## Example
```ts
export const setupCanvas = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not supported');

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  new ResizeObserver(resize).observe(canvas);
  resize();
  return ctx;
};

export const startLoop = (frame: (dtMs: number) => void): (() => void) => {
  let last = performance.now();
  let id = 0;
  const tick = (now: number): void => {
    frame(now - last);
    last = now;
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
};
```

## Avoid
- `setInterval` for rendering.
- Reading pixels (`getImageData`) every frame.
- Creating gradients/patterns/paths inside the hot loop when they could be cached.

Related: [[pixijs]], [[typescript]], [[atomic-design]].
