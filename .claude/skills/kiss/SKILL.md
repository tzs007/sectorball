---
name: kiss
description: Use when designing or implementing any feature, to choose the simplest working solution and avoid over-engineering (Keep It Simple, Stupid / YAGNI).
---

# KISS — Keep It Simple

## Rules
- Implement the simplest solution that meets the **current** requirement. No speculative features (YAGNI).
- Prefer plain functions and data over class hierarchies; add abstraction only when a concrete need appears.
- Short functions (~≤30 lines) with one job and descriptive names. Early returns over deep nesting.
- Few parameters (≤3); group more into a typed options object.
- Use the platform and existing deps before adding a new library.
- Readable over clever: no dense one-liners, bit tricks or nested ternaries without a clear benefit.
- Don't add config options, plugin systems or generic layers "for later".
- When two designs work, choose the one with fewer moving parts and that is easier to delete.

## Example
```ts
// Over-engineered
// class ScoreStrategyFactory { create(type: ScoreType): IScoreStrategy { ... } }

// Simple
export const addGoal = (score: Score, team: TeamId): Score => ({ ...score, [team]: score[team] + 1 });
```

## Balance
KISS limits [[dry]] and [[solid]]: apply those principles where they reduce complexity, not to tick a box.
