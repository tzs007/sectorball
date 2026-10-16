# sectorball

## Stack
- TypeScript (ES modules, strict) — skill: `typescript`
- Rendering: **PixiJS v8** (`pixi.js`) — always start with the `pixijs` skill, which routes to the specialised
  `pixijs-*` skills. For APIs not covered there, fetch `https://pixijs.download/release/docs/llms.txt`.
  Do not use v7 APIs (`beginFill`/`endFill`, `@pixi/*` packages) — see `pixijs-migration-v8`.
- Real-time multiplayer: Socket.IO — skill: `socket-io`

## Principles
Apply the `kiss`, `dry`, `solid` and `atomic-design` skills when designing or changing code.
Follow the `git` skill for branches and commit messages.

## Skills
Project skills live in `.claude/skills/`. The `pixijs*` skills are vendored from
https://github.com/pixijs/pixijs-skills (MIT) — update by re-copying `skills/` from that repo, don't edit them locally.
