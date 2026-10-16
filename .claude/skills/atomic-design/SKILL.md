---
name: atomic-design
description: Use when creating, organising or placing UI / visual components (DOM or Konva) — atoms, molecules, organisms, templates, pages.
---

# Atomic design pattern

Build UI from small, reusable pieces composed upward. Applies to DOM components **and** Konva visual components.

## Levels
| Level | What it is | Examples |
|---|---|---|
| **atoms** | Smallest building block, no domain logic, configured via props | `Button`, `Label`, `Icon`; Konva: `BallShape`, `TextLabel` |
| **molecules** | A few atoms working together as one unit | `ScoreBadge` (icon + label), `PlayerToken` (circle + name) |
| **organisms** | Self-contained, meaningful section | `Scoreboard`, `Pitch` / `SectorGrid`, `ChatPanel` |
| **templates** | Layout of organisms with placeholder content, no real data | `GameLayout`, `LobbyLayout` |
| **pages** | Templates filled with real data and wired to state / sockets | `GamePage`, `LobbyPage` |

## Folder structure
```
src/ui/
  atoms/
  molecules/
  organisms/
  templates/
  pages/
```
One component per file (or folder with `index.ts`), named after the component.

## Rules
- **Dependencies point downward only:** pages → templates → organisms → molecules → atoms.
  An atom never imports a molecule; nothing imports from `pages`.
- Atoms and molecules are presentational: input via props/options, output via callbacks/events.
  No direct socket or global state access below the organism/page level.
- Only pages (and possibly organisms) talk to sockets / stores.
- Each component exposes a `destroy()`/dispose to clean up its nodes and listeners (see `konva`).
- Don't force a level: if unsure between molecule and organism, pick the simpler one ([[kiss]]).

## Example (Konva)
```ts
// atoms/BallShape.ts
export const createBallShape = ({ x, y, radius, fill }: BallProps): Konva.Circle =>
  new Konva.Circle({ x, y, radius, fill, listening: false });

// molecules/PlayerToken.ts
export const createPlayerToken = ({ name, color, x, y }: PlayerTokenProps): Konva.Group => {
  const group = new Konva.Group({ x, y });
  group.add(createBallShape({ x: 0, y: 0, radius: 16, fill: color }), createTextLabel({ text: name, y: 20 }));
  return group;
};
```

Related: [[solid]], [[dry]], [[konva]].
