---
name: typescript
description: Use when writing or reviewing any TypeScript / ES6+ code in this project — types, modules, async code, tsconfig.
---

# TypeScript / ES6+

## Rules
- `tsconfig.json` runs with `"strict": true` (plus `noUncheckedIndexedAccess`, `noImplicitOverride`). Never loosen it to make code compile.
- ES modules only (`import` / `export`). Prefer named exports; avoid default exports.
- `const` by default, `let` only when reassigned, never `var`.
- Arrow functions for callbacks and small helpers; `function` declarations are fine for top-level named functions.
- Use destructuring, spread, optional chaining (`?.`) and nullish coalescing (`??`).
- `async`/`await` over raw `.then()` chains. Always handle rejections.
- No `any`. Use `unknown` at boundaries (network, socket payloads, JSON) and narrow with type guards.
- Model states with **discriminated unions**, not boolean flags.
- Prefer string-literal unions (`'idle' | 'running'`) or `as const` objects over `enum`.
- Mark data that should not change as `readonly` / `ReadonlyArray<T>`.
- `interface` for object shapes that may be extended/implemented; `type` for unions, mapped and utility types.
- Explicit return types on exported functions.
- Use `satisfies` to check literals without widening.

## Example
```ts
export type GameState =
  | { readonly kind: 'lobby'; readonly players: ReadonlyArray<PlayerId> }
  | { readonly kind: 'playing'; readonly tick: number }
  | { readonly kind: 'finished'; readonly winner: PlayerId };

export const isPlayerId = (v: unknown): v is PlayerId =>
  typeof v === 'string' && v.length > 0;

export function describe(state: GameState): string {
  switch (state.kind) {
    case 'lobby': return `${state.players.length} players waiting`;
    case 'playing': return `tick ${state.tick}`;
    case 'finished': return `winner: ${state.winner}`;
    default: return assertNever(state);
  }
}

const assertNever = (x: never): never => { throw new Error(`Unexpected: ${JSON.stringify(x)}`); };
```

## Avoid
- `any`, `as` casts to silence errors, non-null assertions (`!`) without a reason.
- `// @ts-ignore` (use `// @ts-expect-error` with a comment if truly needed).
- Mutating function arguments.

Related: [[solid]], [[kiss]].
