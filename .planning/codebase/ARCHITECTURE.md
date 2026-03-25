# Architecture

**Analysis Date:** 2026-03-25

## Pattern Overview

**Overall:** Modular, Server-authoritative, Event-driven, Isomorphic JS

**Key Characteristics:**

- Shared codebase for server and client (isomorphic modules in `shared/`)
- Server-authoritative game state (all logic validated and resolved on server)
- Modular delegation (Champion, Combat, Status, UI split)
- Event-driven hooks for extensibility (combatEvents, statusEffects)
- Deterministic animation/event queue on client

## Layers

**Server:**

- Purpose: Game session, combat logic, networking
- Location: `src/server.js`
- Contains: Express server, Socket.IO, game loop, session management
- Depends on: `shared/engine`, `shared/core`, `shared/data`
- Used by: Node.js runtime

**Client:**

- Purpose: UI, user input, rendering, animation
- Location: `public/js/main.js`, `public/index.html`, `public/styles/`
- Contains: SPA UI, DOM logic, animation manager, socket client
- Depends on: `shared/`, Socket.IO
- Used by: Browser

**Shared:**

- Purpose: Core game logic, data models, combat pipeline, champion logic
- Location: `shared/`
- Contains: Champion, combat, status, VFX, data, utilities
- Depends on: None (pure JS)
- Used by: Both server and client

## Data Flow

**Game Session:**

1. Client connects via Socket.IO
2. Server allocates player slot, manages session via `GameMatch`
3. Champion selection, team assignment
4. Turn-based actions: client emits intentions, server validates and resolves
5. Server emits canonical state and combat envelopes
6. Client animates, updates UI, confirms animation completion

**Combat Pipeline:**

1. Player action → server enqueues Action
2. On turn end, server instantiates `TurnResolver`
3. Actions sorted by priority/speed, executed in order
4. Each skill triggers pipeline: DamageEvent (9 steps), hooks, status, VFX
5. Results emitted as envelopes to clients
6. Clients animate, sync state

**State Management:**

- Server: `GameMatch` (lobby, combat), authoritative state
- Client: Local UI state, synced via server events
- Shared: Champion, combat, status logic

## Key Abstractions

**Champion:**

- Purpose: Data and logic for a combatant
- Examples: `shared/core/Champion.js`, `shared/core/championCombat.js`, `shared/core/championStatus.js`, `shared/core/championUI.js`
- Pattern: Facade + delegated modules

**GameMatch:**

- Purpose: Session container (players, combat, lobby)
- Examples: `shared/engine/match/GameMatch.js`, `shared/engine/match/Player.js`
- Pattern: State container, public API

**TurnResolver:**

- Purpose: Turn processing, action resolution
- Examples: `shared/engine/combat/TurnResolver.js`
- Pattern: Orchestrator, pipeline

**DamageEvent:**

- Purpose: Damage calculation pipeline
- Examples: `shared/engine/combat/DamageEvent.js`, `shared/engine/combat/pipeline/`
- Pattern: Stepwise pipeline, event-driven

## Entry Points

**Server:**

- Location: `src/server.js`
- Triggers: Node.js process, `npm start`
- Responsibilities: Start server, manage sessions, emit/receive socket events

**Client:**

- Location: `public/index.html`, `public/js/main.js`
- Triggers: Browser load
- Responsibilities: Render UI, handle input, connect to server, animate events

## Error Handling

**Strategy:**

- Server validates all actions, emits denial events
- Client disables UI on turn lock, displays errors

**Patterns:**

- Try/catch in async handlers
- Defensive checks on all socket events
- Validation hooks (e.g., `onValidateAction`)

## Cross-Cutting Concerns

**Logging:** Console logs, combat logs, debug overlays
**Validation:** Server-side hooks, registry checks, status effect validation
**Authentication:** Username only (no password), slot assignment

---

_Architecture analysis: 2026-03-25_
