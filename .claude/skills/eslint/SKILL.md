---
name: eslint
description: Use when linting, fixing lint errors, or changing lint rules in this monorepo — ESLint 10 flat config with typescript-eslint (type-checked), react-hooks and react-refresh.
---

# ESLint (flat config, monorepo)

## Setup
- **One config** for the whole repo: root `eslint.config.js`. Workspaces have no own config; ESLint finds the
  root one by walking up from each file.
- Tooling lives in the **root** `devDependencies`: `eslint`, `@eslint/js`, `typescript-eslint`, `globals`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- Blocks in the config:
  - `**/*.{ts,tsx}` → `js.configs.recommended` + `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked`,
    type info via `parserOptions.projectService` (uses each workspace's `tsconfig.json`).
  - `game/**` → react-hooks + react-refresh (Vite), browser globals.
  - `api/**` → Node globals.
  - `**/*.config.ts` → default exports allowed.
- Project rules enforcing other skills: no `enum` and no default exports (`no-restricted-syntax`, see `typescript`),
  `consistent-type-imports`, unused vars allowed only with a `_` prefix.

## TypeScript version constraint
typescript-eslint needs the TypeScript **JS API**. TypeScript 7 (native/Go) has none, so the repo is pinned to
**TypeScript `~6.0.x`** in every workspace and the root. Don't upgrade to TS 7 until typescript-eslint supports it
(check its `peerDependencies.typescript`).

## Commands
```bash
npm run lint                     # all workspaces (each runs `eslint .`)
npm run lint -w game             # one workspace
npx eslint --fix path/to/file.ts # fix one file
```
Lint must pass with **zero warnings** (lint-staged uses `--max-warnings=0`; see `husky`).

## Rules for fixing
- Fix the code, not the rule. Don't add `eslint-disable` to make a commit pass.
- If a disable is truly needed, make it line-scoped with the rule name and a reason:
  `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- canvas always exists after mount`
- New files must be included in their workspace `tsconfig.json` (`include`), otherwise type-aware linting
  fails with "file not found in project".
- Change rules only in `eslint.config.js`, with a short comment why.

Related: [[typescript]], [[husky]], [[npm-workspaces]], [[react]].
