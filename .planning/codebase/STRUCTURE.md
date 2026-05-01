# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```
[project-root]/
├── src/                 # Node.js server entry point
├── shared/              # Isomorphic game engine + data + UI helpers
├── public/              # Browser client (HTML/CSS/JS/assets)
├── scripts/             # Local CLI/dev scripts
├── readme/              # Architecture and design docs
├── get-shit-done/       # GSD workflows/templates/agents
├── agents/              # GSD agent definitions
├── outdated/            # Legacy code snapshots
├── package.json         # Project manifest
├── jsconfig.json        # Editor tooling config
└── STATE.md             # Project state log
```

## Directory Purposes

**src/**
- Purpose: Server runtime (Express + Socket.IO).
- Contains: `server.js`.
- Key files: `src/server.js`.

**shared/**
- Purpose: Core engine, data, and UI helpers used by both server and client.
- Contains: `core/`, `engine/`, `data/`, `ui/`, `utils/`, `vfx/`.
- Key files: `shared/core/Champion.js`, `shared/engine/combat/TurnResolver.js`.

**public/**
- Purpose: Client UI, static assets, and browser JS.
- Contains: `index.html`, `js/`, `styles/`, `assets/`.
- Key files: `public/js/main.js`, `public/styles/ui.css`.

**scripts/**
- Purpose: Local CLI/dev utilities.
- Key files: `scripts/damageEventLab.js`.

**readme/**
- Purpose: Architecture documentation.
- Key files: `readme/GAME_ARCHITECTURE_v6_0 (current).md`.

## Key File Locations

**Entry Points:**
- `src/server.js` - Node server + Socket.IO
- `public/js/main.js` - Browser client entry

**Configuration:**
- `package.json` - Dependencies + scripts
- `jsconfig.json` - JS tooling config

**Core Logic:**
- `shared/engine/` - Combat and match logic
- `shared/core/` - Champion facade + delegated modules
- `shared/data/` - Champions and status effects

**Testing:**
- No dedicated test directory or configs detected.

**Documentation:**
- `readme/GAME_ARCHITECTURE_v6_0 (current).md`
- `STATE.md`, `STATE.archive.md`

## Naming Conventions

**Files:**
- camelCase for JS modules (`championCombat.js`, `damageEventLab.js`).
- PascalCase for core classes (`Champion.js`, `GameMatch.js`).

**Directories:**
- lowercase folders, often plural (`scripts/`, `assets/`).

**Special Patterns:**
- `index.js` as registry/export in data directories (`shared/data/champions/index.js`).

## Where to Add New Code

**New Feature:**
- Server logic: `src/`
- Engine logic: `shared/engine/`
- Client UI: `public/js/`

**New Champion:**
- Definition: `shared/data/champions/{champion}/`
- Registry: `shared/data/champions/index.js`

**Utilities:**
- Shared helpers: `shared/utils/`

## Special Directories

**outdated/**
- Purpose: Legacy or deprecated code snapshots.
- Committed: Yes.

**get-shit-done/**
- Purpose: GSD workflows, templates, and references.
- Committed: Yes.

---

*Structure analysis: 2026-04-21*
*Update when directory structure changes*