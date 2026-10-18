---
name: react
description: Use when writing or reviewing React 19 components, hooks, pages or project structure in this SPA — including PixiJS rendering through @pixi/react (Application, extend, pixi* elements, useTick, useApplication).
---

# React 19 (+ @pixi/react)

## Project structure (Vite SPA — `game` workspace, see `npm-workspaces`)
```
game/src/
  main.tsx            # entry: createRoot + <StrictMode>
  App.tsx             # root: useSession + useMatchRoute → LoginPage | LobbyPage | MatchPage (no router library)
  pages/              # route-level components, wire data/state/sockets
    LoginPage.tsx     #   guest login (nickname)
    LobbyPage.tsx     #   open matches, Új meccs / Csatlakozás, logout (useLobby)
    MatchPage.tsx     #   one match over Socket.IO (useMatch) → Game organism
  components/
    atoms/            # see `atomic-design` skill
    molecules/
    organisms/
    templates/
  hooks/              # custom hooks: useXxx.ts
    useSession.ts     #   guest session in localStorage `sectorball.session`
    useMatchRoute.ts  #   current match id in the URL hash `#/match/<id>`
    useLobby.ts       #   REST: list (every 3 s) / create / join matches
    useMatch.ts       #   socket: match:watch on every connect, view, replay queue, actions
    useReplayQueue.ts, useReplayPlayback.ts, useAimDrag.ts, useNow.ts
  services/           # side-effect code, no React imports
    apiClient.ts      #   REST client (fetch), ApiError(status, code)
    gameSocket.ts     #   typed Socket.IO client (connectGameSocket)
  constants/          # single source of truth for config values (see `dry`)
  types/              # shared domain types
  utils/              # pure helper functions
  styles/             # global CSS
  assets/             # images, fonts imported from code
game/public/          # static files served as-is
```
- One component per file, `PascalCase.tsx`; hooks `useCamelCase.ts`; others `camelCase.ts`.
- Named exports only (`export const Foo = ...`), no default exports.
- Dependencies point downward: pages → templates → organisms → molecules → atoms.

## Components
- Function components only. Type props with an exported `type XxxProps = { ... }`.
- Keep components small and presentational; move logic into custom hooks or `services/`.
- React 19: `ref` is a normal prop — don't use `forwardRef`. Context is rendered as `<MyContext value={...}>`.
- Stable, unique `key` for list items (an id, never the array index for dynamic lists).
- Derive values during render instead of syncing them into state with `useEffect`.
- `useEffect` only for synchronising with external systems (sockets, DOM, timers) — always return a cleanup.
- Don't add `useMemo` / `useCallback` / `memo` by default; add them when there is a measured need or when
  a stable identity is required (e.g. `@pixi/react` `draw` and `useTick` callbacks).
- State: local `useState` / `useReducer` first; lift up or use context only when several components need it.

## @pixi/react (v8)
- Register every PixiJS class you render **once**, at module level: `extend({ Container, Graphics, Sprite, Text })`.
  Using an element that wasn't extended throws at runtime.
- Use prefixed intrinsic elements: `<pixiContainer>`, `<pixiGraphics>`, `<pixiSprite>`, `<pixiText>`.
- Wrap the scene in `<Application>`; it accepts all `ApplicationOptions` props. `resizeTo` accepts a React ref.
- `useApplication()` and `useTick()` only work in **children** of `<Application>`.
- `pixiGraphics` `draw` callback: wrap in `useCallback`, start with `g.clear()`, use v8 shape-then-fill
  (`g.circle(x, y, r).fill(color)`).
- `useTick` callbacks are not memoised — wrap them in `useCallback`.
- **Never `setState` every frame.** Per-frame animation mutates the PixiJS object through a `ref`
  inside `useTick`; React state is for discrete changes (score, phase, selected item).
- For PixiJS API details use the `pixijs` skill and its sub-skills.

## Example
```tsx
import { Application, extend, useTick } from '@pixi/react';
import { Container, Graphics } from 'pixi.js';
import { useCallback, useRef } from 'react';

extend({ Container, Graphics });

type BallProps = { readonly radius: number; readonly color: string };

const Ball = ({ radius, color }: BallProps) => {
  const ref = useRef<Graphics>(null);
  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.circle(0, 0, radius).fill(color);
  }, [radius, color]);

  useTick(useCallback((ticker) => {
    if (ref.current) ref.current.rotation += 0.01 * ticker.deltaTime;
  }, []));

  return <pixiGraphics ref={ref} draw={draw} x={200} y={150} />;
};

export const Scene = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Application resizeTo={containerRef} background="#0b3d20">
        <Ball radius={12} color="#ffffff" />
      </Application>
    </div>
  );
};
```

## Testing
Write components test-first with Testing Library — see `vitest-tdd`. PixiJS doesn't render in jsdom, so keep
game logic in pure modules and `@pixi/react` components thin.

## Avoid
- Class components, default exports, `React.FC` with implicit `children`.
- Fetching or socket subscriptions directly inside atoms/molecules.
- Recreating PixiJS objects on every render; storing authoritative game state in PixiJS objects.

Related: [[atomic-design]], [[typescript]], [[pixijs]], [[socket-io]], [[kiss]].
