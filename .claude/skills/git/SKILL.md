---
name: git
description: Use when committing, branching, writing commit messages, or preparing pull requests in this project.
---

# Git workflow

## Rules
- Commit or push only when the user asks.
- Work on a feature branch created from `main`: `feat/<short-topic>`, `fix/<short-topic>`, `chore/<short-topic>`.
- **Conventional Commits** for messages:
  ```
  <type>(<optional scope>): <imperative summary, ≤72 chars>

  <optional body: why, not what>
  ```
  Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`.
- Small, atomic commits: one logical change per commit; the build should pass at every commit.
- Before committing: run type-check, lint and tests if they exist; review `git diff --staged`.
- Stage files explicitly (`git add <path>`); avoid `git add -A` so secrets/build output are not committed.
- Never commit `.env`, credentials, `node_modules`, or build output — keep `.gitignore` up to date.
- Never force-push to `main`. On feature branches prefer `--force-with-lease`.
- Never skip hooks (`--no-verify`) unless the user explicitly asks.
- Prefer creating a new commit over amending an already-pushed one.

## Examples
```
feat(board): render sector grid with Konva
fix(socket): rejoin room after reconnect
refactor(player): extract movement into PlayerController
```

Related: [[kiss]].
