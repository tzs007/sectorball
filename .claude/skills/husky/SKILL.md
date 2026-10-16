---
name: husky
description: Use when committing, when a git hook fails, or when changing git hooks — husky v9 pre-commit hook running lint-staged, typecheck and tests.
---

# Husky + lint-staged (git hooks)

## Setup
- `husky` and `lint-staged` are root `devDependencies`. The root `"prepare": "husky"` script installs the hooks
  on `npm install` (sets `core.hooksPath` to `.husky/_`).
- `.husky/pre-commit` (plain shell, no shebang/boilerplate needed in husky v9):
  ```sh
  npx lint-staged      # eslint --fix --max-warnings=0 on staged *.ts/*.tsx
  npm run typecheck    # tsc --noEmit in every workspace
  npm test             # vitest run in every workspace
  ```
- lint-staged config is the `"lint-staged"` key in the root `package.json`. It re-stages files it auto-fixed.
- `.husky/_/` is generated and self-ignored — never edit or commit it.

## Rules
- **Never bypass the hook** (`git commit --no-verify`, `HUSKY=0`) unless the user explicitly asks.
- When the hook fails: read the output, fix the cause (lint error, type error, failing test), re-stage, commit
  again as a new attempt. Don't amend unrelated commits to sneak a fix in.
- Keep the hook fast. If the test suite grows slow, switch `npm test` to
  `npx vitest related --run <staged files>` via lint-staged rather than removing tests from the hook.
- Add new checks to the hook only when they run in seconds; heavier checks belong in CI.

Related: [[git]], [[eslint]], [[vitest-tdd]], [[npm-workspaces]].
