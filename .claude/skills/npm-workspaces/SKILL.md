---
name: npm-workspaces
description: Use when installing/removing packages, adding scripts, creating a new package, or running commands in this monorepo — npm workspaces (game, api), -w flags, root scripts, shared tsconfig. No Nx/Turborepo.
---

# npm workspaces (monorepo)

The repo is a plain **npm workspaces** monorepo — no Nx, Turborepo or Lerna. Keep it that way unless asked.

## Layout
```
package.json          # root: "workspaces", orchestration scripts, shared dev tools only
package-lock.json     # ONE lockfile for the whole repo (never create lockfiles inside workspaces)
tsconfig.base.json    # shared strict compiler options; each workspace extends it
eslint.config.js      # single ESLint flat config for all workspaces
.husky/pre-commit     # lint-staged + typecheck + test
game/                 # @sectorball/game — React 19 + PixiJS SPA (Vite)   → see `react`, `pixijs`
api/                  # @sectorball/api  — Node + Express 5 backend        → see `nodejs`, `expressjs`
```
Package names use the `@sectorball/<name>` scope; all are `"private": true`.

## Installing packages
Always run npm from the **repo root** and target a workspace with `-w`:
```bash
npm install pixi.js -w game              # runtime dep of game
npm install -D @types/node -w api        # dev dep of api
npm uninstall helmet -w api
npm install -D concurrently              # root-only tooling (no -w)
```
- Never `cd game && npm install` — it bypasses the root lockfile.
- A dependency belongs to the workspace that imports it. The root `package.json` holds only repo-wide tooling.
- Keep shared tool versions (e.g. `typescript`, `vitest`) identical across workspaces so npm dedupes them.
  TypeScript is pinned to `~6.0.x` everywhere (typescript-eslint doesn't support TS 7 — see `eslint`).
- Repo-wide tooling (ESLint + plugins, husky, lint-staged, concurrently) lives in the root `devDependencies`.

## Running scripts
```bash
npm run dev                        # api + game together (concurrently)
npm run dev:api | npm run dev:game
npm run typecheck                  # tsc --noEmit in every workspace
npm run lint                       # eslint in every workspace (see `eslint`)
npm test                           # vitest run in every workspace (see `vitest-tdd`)
npm run build                      # every workspace that has a build script
npm run <script> -w api            # one workspace
npm run <script> --workspaces --if-present
npm exec -w game -- vite --help    # run a workspace binary
```
Every workspace must expose `typecheck`, `lint`, `test` and `test:watch` scripts; `dev`/`build`/`start` where it
makes sense. The pre-commit hook runs lint-staged + typecheck + test (see `husky`).

## TypeScript
- Each workspace has its own `tsconfig.json` that `extends: "../tsconfig.base.json"` and sets only
  environment-specific options (`lib`, `types`, `module`, `moduleResolution`, `jsx`).
  - `game`: `moduleResolution: "bundler"`, `types: ["@types/web", "vite/client"]`, `jsx: "react-jsx"`.
  - `api`: `module`/`moduleResolution: "nodenext"`, `types: ["node"]`, `erasableSyntaxOnly` (Node type stripping).
- Strictness flags live **only** in the base config — don't override them per workspace.
- `npm run typecheck` at the root must pass before every commit.

## Adding a new workspace (e.g. `shared/` for socket event contracts)
1. Create `shared/package.json` with `"name": "@sectorball/shared"`, `"private": true`, `"type": "module"`,
   `"exports": { ".": "./src/index.ts" }` and a `typecheck` script.
2. Add `shared/tsconfig.json` extending the base config.
3. Add `"shared"` to the root `"workspaces"` array, then `npm install` at the root.
4. Depend on it from another workspace: `npm install @sectorball/shared -w api` (npm links it locally).

## Avoid
- Relative imports across workspace boundaries (`../../api/src/...`) — import the package name instead.
- Per-workspace `node_modules` installs or lockfiles.
- Introducing a monorepo build tool for problems npm scripts already solve ([[kiss]]).

Related: [[nodejs]], [[react]], [[git]], [[eslint]], [[husky]], [[vitest-tdd]].
