# Codebase Structure

**Analysis Date:** 2026-03-25

## Directory Layout

```
[project-root]/
├── src/            # Server entrypoint and logic
│   └── server.js
├── public/         # Static assets and client code
│   ├── index.html
│   ├── js/
│   │   ├── main.js
│   │   ├── gameGlossary.js
│   │   └── animation/
│   │       └── animsAndLogManager.js
│   ├── styles/
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── ui.css
│   │   ├── animations.css
│   │   └── vfx.css
│   └── assets/
│       └── portraits/
├── shared/         # Isomorphic game logic (server+client)
│   ├── core/
│   ├── engine/
│   ├── data/
│   ├── ui/
│   ├── utils/
│   └── vfx/
├── scripts/        # Utility scripts
├── readme/         # Documentation
└── package.json
```

## Directory Purposes

**src/**

- Purpose: Server entrypoint and logic
- Contains: Express server, Socket.IO, session/game loop
- Key files: `src/server.js`

**public/**

- Purpose: Client SPA, static assets
- Contains: HTML, JS, CSS, images
- Key files: `public/index.html`, `public/js/main.js`, `public/styles/`

**shared/**

- Purpose: Shared game logic and data
- Contains: Champion, combat, status, VFX, data, utilities
- Key files: `shared/core/Champion.js`, `shared/engine/combat/TurnResolver.js`, `shared/engine/combat/DamageEvent.js`, `shared/data/championDB.js`

**scripts/**

- Purpose: Utility scripts (e.g., test, export)
- Contains: Standalone JS scripts
- Key files: `scripts/test.js`, `exportChampionsToJson.js`

**readme/**

- Purpose: Documentation and architecture history
- Contains: Markdown docs
- Key files: `readme/GAME_ARCHITECTURE_v5_1 (current).md`

## Key File Locations

**Entry Points:**

- `src/server.js`: Server entry
- `public/index.html`, `public/js/main.js`: Client entry

**Configuration:**

- `package.json`: Project config, dependencies

**Core Logic:**

- `shared/core/Champion.js`: Champion model
- `shared/engine/combat/TurnResolver.js`: Turn logic
- `shared/engine/combat/DamageEvent.js`: Combat pipeline
- `shared/data/championDB.js`: Champion registry

**Testing:**

- `scripts/test.js`: Test script (manual)

## Naming Conventions

**Files:**

- camelCase or kebab-case for JS files (e.g., `championDB.js`, `gameGlossary.js`)
- PascalCase for classes (e.g., `Champion.js`)

**Directories:**

- Lowercase, descriptive (e.g., `core`, `engine`, `data`)

## Where to Add New Code

**New Feature:**

- Primary code: `shared/` (for logic), `public/js/` (for UI)
- Tests: `scripts/` (manual)

**New Component/Module:**

- Implementation: `shared/` (core logic), `public/js/` (UI)

**Utilities:**

- Shared helpers: `shared/utils/`

## Special Directories

**shared/data/champions/**

- Purpose: Per-champion logic and data
- Generated: No
- Committed: Yes

---

_Structure analysis: 2026-03-25_
