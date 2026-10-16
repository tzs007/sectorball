---
name: atomic-design
description: Use when creating, organising or placing UI / visual components (DOM / React or PixiJS) — atoms, molecules, organisms, templates, pages.
---

# Atomic design pattern

Build UI from small, reusable pieces composed upward. Applies to DOM / React components **and** PixiJS display objects.

## Levels
| Level | What it is | Examples |
|---|---|---|
| **atoms** | Smallest building block, no domain logic, configured via props | `Button`, `Label`, `Icon`; PixiJS: `createBall`, `createLabel` |
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
- Each component exposes a `destroy()`/dispose to clean up its resources and listeners (PixiJS: `destroy({ children: true })`).
- Don't force a level: if unsure between molecule and organism, pick the simpler one ([[kiss]]).

## Example (PixiJS)
```ts
import { Container, Graphics, Text } from 'pixi.js';

// atoms/createBall.ts
export const createBall = ({ radius, fill }: BallProps): Graphics =>
  new Graphics().circle(0, 0, radius).fill(fill);

// molecules/createPlayerToken.ts
export const createPlayerToken = ({ name, color, x, y }: PlayerTokenProps): Container => {
  const token = new Container({ x, y });
  const label = new Text({ text: name, style: { fontSize: 12, fill: '#fff' } });
  label.anchor.set(0.5, 0);
  label.y = 20;
  token.addChild(createBall({ radius: 16, fill: color }), label);
  return token;
};
```

Related: [[solid]], [[dry]], [[pixijs]].
