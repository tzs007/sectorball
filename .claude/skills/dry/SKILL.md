---
name: dry
description: Use when writing or refactoring code and noticing duplicated logic, constants, types or configuration (Don't Repeat Yourself).
---

# DRY — Don't Repeat Yourself

Every piece of *knowledge* (a rule, a constant, a type, a protocol definition) should have a single,
authoritative source.

## Rules
- Before writing a helper, search the codebase for an existing one and reuse it.
- **Rule of three:** tolerate duplication once; extract on the third occurrence or when the copies must
  change together.
- Duplicate *knowledge* is the problem, not similar-looking code. Two pieces of code that happen to look alike
  but change for different reasons should stay separate.
- Single source of truth for:
  - game constants (sizes, speeds, colours) → one `constants.ts` / theme module
  - socket event names and payload types → one shared `events.ts` used by client and server (see `socket-io`)
  - domain types → shared types module
- Derive instead of duplicating: `type Keys = keyof typeof CONFIG`, `as const` arrays → union types.
- Extract repeated Konva node setup into factories / atoms (see `atomic-design`).

## Example
```ts
// Before: magic numbers repeated across files
// new Konva.Circle({ radius: 12, fill: '#ff5722' })

// After
export const BALL = { radius: 12, fill: '#ff5722' } as const;
new Konva.Circle({ ...BALL, x, y });
```

## Avoid
- Premature, speculative abstractions with many flags/parameters — that violates [[kiss]].
- Copy-pasting a block and tweaking one value; parameterise it instead.

Related: [[kiss]], [[solid]].
