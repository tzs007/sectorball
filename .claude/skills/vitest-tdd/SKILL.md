---
name: vitest-tdd
description: Use when implementing any feature or bugfix in game/ or api/ — test-driven development with Vitest (red → green → refactor), Testing Library for React, supertest for Express, test file conventions.
---

# TDD with Vitest

## Workflow (always)
1. **Red** — write a small failing test for the next behaviour. Run it and *see it fail for the right reason*.
2. **Green** — write the minimum code to make it pass. No extra features ([[kiss]]).
3. **Refactor** — clean up code and tests while everything stays green ([[dry]], [[solid]]).
4. Repeat in small steps. Bugfix = first a test that reproduces the bug.

```bash
npm run test:watch -w api          # TDD loop for one workspace
npm run test:watch -w game
npm test                           # everything once (also runs in the pre-commit hook)
npx vitest run src/app.test.ts     # single file (from inside the workspace dir) or:
npm exec -w api -- vitest run src/app.test.ts
```

## Conventions
- Test file next to the code: `Foo.tsx` → `Foo.test.tsx`, `roomService.ts` → `roomService.test.ts`.
- Explicit imports, no globals: `import { describe, it, expect, vi } from 'vitest'`.
- Test names describe behaviour: `it('responds 404 when the room does not exist')`.
- Arrange → Act → Assert, one behaviour per test. Test public behaviour, not implementation details.
- Prefer real objects and in-memory fakes (e.g. an in-memory repository) over mocks. Use `vi.fn()` / `vi.spyOn`
  only at boundaries (network, timers, randomness). Use `vi.useFakeTimers()` for time-based game logic.
- Keep tests deterministic: inject randomness/clock as dependencies.

## game (React + PixiJS) — `game/vite.config.ts` → `test`
- Environment `jsdom`; setup `src/test/setup.ts` loads `@testing-library/jest-dom/vitest` matchers and cleanup.
- React components: `@testing-library/react` + `@testing-library/user-event`. Query by role/label/text
  (`getByRole('button', { name: 'Start' })`), not by class names or test ids unless unavoidable.
- **PixiJS does not render in jsdom (no WebGL).** Keep game logic (physics, rules, state reducers) in pure
  TS modules and test those directly; keep `@pixi/react` components thin so they need no unit tests,
  or test them by mocking the PixiJS component boundary.

## api (Express) — `api/vitest.config.ts`
- Environment `node`. HTTP tests with `supertest` against `createApp(deps)` — no real port:
  ```ts
  const res = await request(createApp({ rooms: fakeRooms })).post('/api/rooms').send({ name: 'A' });
  expect(res.status).toBe(201);
  ```
- Services (`mvc-crud`) are tested directly with an in-memory repository; controllers/routes via supertest.
- Socket.IO handlers: test the service they call; for integration, start the server on port `0` and connect
  with `socket.io-client` in the test.

## Avoid
- Writing code first and tests "later".
- Snapshot tests for logic. Tests that depend on execution order or shared mutable state.
- Skipped/focused tests (`it.skip`, `it.only`) in commits.

Related: [[mvc-crud]], [[react]], [[expressjs]], [[husky]].
