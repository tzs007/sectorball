---
name: konva
description: Use when building or changing anything rendered with Konva.js — stages, layers, shapes, events, animations, drag & drop, performance.
---

# Konva.js

## Documentation — use the MCP first
This project ships a `konva-documentation` MCP server (`.mcp.json`). **Before using an unfamiliar Konva API,
option or event, query the `konva-documentation` MCP** instead of relying on memory. Konva APIs change between
versions; verify signatures there.

## Structure
- Hierarchy: `Stage` → `Layer` → `Group` → `Shape`.
- Keep layers few (≈3–5): each layer is a separate `<canvas>`. Typical split:
  `backgroundLayer` (static), `gameLayer` (dynamic), `uiLayer` (HUD / overlays).
- Group related shapes in a `Konva.Group` and move/transform the group, not each child.
- Wrap each visual entity in its own small class/factory that owns its Konva nodes (see `atomic-design`, `solid`).
  Game state lives outside Konva; nodes are a view of that state.

## Performance
- `listening(false)` on shapes/layers that never need events (backgrounds, decorations).
- `layer.batchDraw()` / rely on auto-draw — never call `draw()` in a loop.
- `node.cache()` for complex static groups; re-cache only when they change.
- Use `Konva.Animation` or `Konva.Tween` for motion; update attributes, don't recreate nodes.
- For many moving objects, consider `perfectDrawEnabled(false)` and `shadowForStrokeEnabled(false)`.
- Move a dragged node to a dedicated drag layer during drag if the main layer is heavy.
- Custom drawing: `new Konva.Shape({ sceneFunc(ctx, shape) { ...; ctx.fillStrokeShape(shape); } })` (see `canvas`).

## Events
- Prefer event delegation: one listener on a layer/group, inspect `e.target`.
- Use namespaced events (`'click.selection'`) so they can be removed precisely with `off`.
- Use `stage.getPointerPosition()` / `getRelativePointerPosition()` for coordinates.

## Lifecycle
- Always `destroy()` nodes you remove (not just `remove()`), and `stage.destroy()` on teardown.
- Stop `Konva.Animation`s and remove listeners when a component is disposed.
- Responsive stage: resize via `ResizeObserver` on the container, then `stage.size(...)` / `stage.scale(...)`.

## Example
```ts
import Konva from 'konva';

export const createStage = (container: HTMLDivElement) => {
  const stage = new Konva.Stage({ container, width: container.clientWidth, height: container.clientHeight });
  const background = new Konva.Layer({ listening: false });
  const game = new Konva.Layer();
  stage.add(background, game);

  game.on('click.select', (e) => {
    const id = e.target.id();
    if (id) console.debug('selected', id);
  });

  return { stage, background, game, dispose: () => stage.destroy() };
};
```

## Avoid
- One layer per shape.
- Recreating shapes every frame.
- Storing authoritative game state in Konva node attrs.

Related: [[canvas]], [[socket-io]], [[atomic-design]].
