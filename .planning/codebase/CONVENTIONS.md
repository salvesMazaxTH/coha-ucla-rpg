# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- camelCase for most JS modules (`championCombat.js`, `damageEventLab.js`).
- PascalCase for core classes (`Champion.js`, `GameMatch.js`, `DamageEvent.js`).

**Functions:**
- camelCase for functions (`handleEndTurn`, `emitCombatEvent`).
- Handlers often prefixed with `handle` or `emit`.

**Variables:**
- camelCase for locals.
- UPPER_SNAKE_CASE for constants (`TEAM_SIZE`, `ACTIVE_PER_TEAM`).

**Types:**
- No explicit TypeScript types in source.

## Code Style

**Formatting:**
- 2-space indentation.
- Double quotes for strings.
- Semicolons used.

**Linting:**
- No ESLint/Prettier configs detected.

## Import Organization

**Order:**
1. External packages (`express`, `socket.io`).
2. Node built-ins (`path`, `fs`).
3. Internal shared modules (`../shared/...`).

**Grouping:**
- Blank lines between import groups (see `src/server.js`).

**Path Aliases:**
- None detected; relative imports used.

## Error Handling

**Patterns:**
- Guard clauses with `if (!value) return` or `throw new Error`.
- Errors logged via `console.error` in hook execution.

## Logging

**Framework:**
- `console.log`/`console.error` used throughout.

**Patterns:**
- Debug blocks commented out and toggled by flags (e.g., `debugMode`).

## Comments

**When to Comment:**
- Inline section headers and descriptive comments are common.

**JSDoc/TSDoc:**
- JSDoc used sparingly for function descriptions (see `shared/ui/formatters.js`).

## Function Design

**Size:**
- Large functions for game loop logic (see `src/server.js`).

**Parameters:**
- Options objects used for complex functions (`processChampionMutationRequest`).

**Return Values:**
- Early returns for guard clauses.

## Module Design

**Exports:**
- Named exports used in shared modules.
- Classes exported by name.

**Barrel Files:**
- `index.js` used as registries for data (champions, status effects).

---

*Convention analysis: 2026-04-21*
*Update when patterns change*