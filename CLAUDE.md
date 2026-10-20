# sectorball

## Stack
- Monorepo: npm workspaces — `game/` (frontend) and `api/` (backend) — skill: `npm-workspaces`.
  Run npm from the repo root (`-w game` / `-w api`); `npm run typecheck` must pass in both.
- TypeScript (ES modules, strict) — skill: `typescript`
- Rendering: **PixiJS v8** (`pixi.js`) — always start with the `pixijs` skill, which routes to the specialised
  `pixijs-*` skills. For APIs not covered there, fetch `https://pixijs.download/release/docs/llms.txt`.
  Do not use v7 APIs (`beginFill`/`endFill`, `@pixi/*` packages) — see `pixijs-migration-v8`.
- UI: React 19 SPA (Vite) + `@pixi/react` v8 — skill: `react` (project structure, components, @pixi/react rules).
- Real-time multiplayer: Socket.IO — skill: `socket-io`
- Server: Node.js 22+ (`nodejs`) + Express 5 (`expressjs`), layered by the `mvc-crud` skill
  (routes → controllers → services → models, REST/CRUD conventions).
- DB: SQLite via `node:sqlite` now (skill `sqlite`), Supabase later (skills `supabase`, `supabase-postgres-best-practices`) — always behind repository interfaces.

## Quality
- **TDD with Vitest** for every feature/bugfix — skill: `vitest-tdd` (Testing Library in `game`, supertest in `api`).
- Lint: ESLint flat config at the root — skill: `eslint`. TypeScript is pinned to `~6.0.x` because
  typescript-eslint does not support TS 7 yet.
- Pre-commit hook (husky + lint-staged): lint, typecheck, test — skill: `husky`. Never bypass it.
- Before finishing any task: `npm run lint && npm run typecheck && npm test` must pass.

## Principles
Apply the `kiss`, `dry`, `solid` and `atomic-design` skills when designing or changing code.
Follow the `git` skill for branches and commit messages.

## Skills
Project skills live in `.claude/skills/`. The `pixijs*` skills are vendored from
https://github.com/pixijs/pixijs-skills (MIT) — update by re-copying `skills/` from that repo, don't edit them locally.
The `supabase` and `supabase-postgres-best-practices` skills are vendored the same way from
https://github.com/supabase/agent-skills (MIT) — don't edit them locally.
