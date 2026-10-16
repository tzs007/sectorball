---
name: solid
description: Use when designing modules, classes or interfaces, or refactoring code structure — Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion.
---

# SOLID principles (TypeScript)

## S — Single Responsibility
A module/class has one reason to change. Separate **game logic**, **rendering** (PixiJS) and **networking** (Socket.IO).
```ts
class BallPhysics { step(ball: Ball, dt: number): Ball { /* ... */ } }   // logic
class BallView    { render(ball: Ball): void { /* PixiJS */ } }            // rendering
```

## O — Open/Closed
Extend behaviour by adding new code, not editing existing switch statements everywhere.
Use maps of handlers / strategies keyed by a discriminant.
```ts
const powerUps: Record<PowerUpKind, (s: GameState) => GameState> = { speed: applySpeed, shield: applyShield };
```

## L — Liskov Substitution
Any implementation of an interface must be usable wherever the interface is expected, without surprises
(no throwing "not supported", no stricter preconditions).

## I — Interface Segregation
Small, focused interfaces instead of one large one.
```ts
interface Renderable { render(): void }
interface Disposable { destroy(): void }
interface Draggable { enableDrag(): void }
```

## D — Dependency Inversion
High-level code depends on abstractions; concrete deps are injected (constructor/function params).
```ts
export interface GameTransport {
  send<E extends keyof ClientToServerEvents>(event: E, ...args: Parameters<ClientToServerEvents[E]>): void;
}

export class GameController {
  constructor(private readonly transport: GameTransport, private readonly view: Renderable) {}
}
// Production: SocketIoTransport. Tests: in-memory fake.
```

## Balance
Apply SOLID where it reduces coupling and eases testing. Don't create interfaces with a single trivial
implementation "just because" — see [[kiss]].

Related: [[dry]], [[atomic-design]], [[typescript]].
