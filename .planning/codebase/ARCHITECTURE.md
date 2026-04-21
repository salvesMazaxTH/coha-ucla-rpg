# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Server-authoritative multiplayer game with shared engine modules.

**Key Characteristics:**
- Node.js server owns game state and emits authoritative snapshots.
- Client is a thin renderer (vanilla JS) that sends intents via Socket.IO.
- Shared `/shared` modules run in both server and client contexts.

## Layers

**Server Layer:**
- Purpose: Host the game session, validate inputs, resolve turns.
- Contains: Express + Socket.IO setup, match orchestration.
- Depends on: Shared engine and data modules.
- Used by: Browser clients via Socket.IO events.

**Shared Engine Layer:**
- Purpose: Core game logic (combat resolution, champions, status effects).
- Contains: `Champion`, `DamageEvent`, `TurnResolver`, combat pipeline, match state.
- Depends on: Shared data and UI helpers.
- Used by: Server and client (isomorphic).

**Shared Data Layer:**
- Purpose: Static definitions for champions and status effects.
- Contains: Champion data, skills, passives, status effect registry.
- Depends on: None (pure data + hooks).
- Used by: Engine and server.

**Client/UI Layer:**
- Purpose: Render the game, collect player input, play animations.
- Contains: `public/js/main.js`, UI helpers, CSS, assets.
- Depends on: Shared UI helpers and engine types serialized from server.
- Used by: Browser runtime.

## Data Flow

**Turn Resolution Flow:**

1. Client emits intents via Socket.IO (`useSkill`, `endTurn`).
2. Server enqueues `Action` objects and waits for both players.
3. `TurnResolver.resolveTurn()` orders actions and executes skills.
4. `DamageEvent` pipeline applies combat effects and hooks.
5. Server emits `combatAction` envelopes + `gameStateUpdate` snapshot.
6. Client animates events and acknowledges completion.

**State Management:**
- In-memory state in `GameMatch` (`LobbyState` + `CombatState`).
- No database or persistence layer.

## Key Abstractions

**GameMatch:**
- Purpose: Master session container for lobby + combat state.
- Examples: `shared/engine/match/GameMatch.js`.

**Champion:**
- Purpose: Core entity representing a combatant with delegated modules.
- Examples: `shared/core/Champion.js` with `championCombat`, `championStatus`, `championUI`.

**DamageEvent Pipeline:**
- Purpose: Deterministic combat resolution via numbered pipeline steps.
- Examples: `shared/engine/combat/DamageEvent.js`, `shared/engine/combat/pipeline/*`.

**Hook System:**
- Purpose: Event-driven extensibility for passives/status effects.
- Examples: `shared/engine/combat/combatEvents.js`.

## Entry Points

**Server Entry:**
- Location: `src/server.js`
- Triggers: `npm start`, Socket.IO connections
- Responsibilities: Host HTTP server, load shared engine, orchestrate game loop

**Client Entry:**
- Location: `public/js/main.js`
- Triggers: Loaded by `public/index.html`
- Responsibilities: Render UI, send events, play animations

## Error Handling

**Strategy:** Mostly inline guards + console logging; errors typically surfaced in logs.

**Patterns:**
- Defensive null checks before action execution.
- Console logging for debug traces (`console.log`, `console.error`).

## Cross-Cutting Concerns

**Logging:**
- Console logging across server and shared modules.

**Validation:**
- Server validates action intents in `src/server.js`.

**Authentication:**
- None (local multiplayer/session only).

---

*Architecture analysis: 2026-04-21*
*Update when major patterns change*