# Coding Conventions

**Analysis Date:** 2026-03-25

## Naming Patterns

**Files:**

- camelCase or kebab-case for JS files (e.g., `championDB.js`, `gameGlossary.js`)
- PascalCase for classes (e.g., `Champion.js`)

**Functions:**

- camelCase (e.g., `applyStatusEffect`, `getSkillCost`)

**Variables:**

- camelCase (e.g., `activeChampions`, `editMode`)

**Types:**

- PascalCase for classes, plain for objects

## Code Style

**Formatting:**

- No formatter config detected; manual formatting
- Indentation: 2 spaces

**Linting:**

- No linter config detected

## Import Organization

**Order:**

1. Node/core modules
2. External dependencies
3. Internal/shared modules

**Path Aliases:**

- Relative imports (e.g., `../shared/core/Champion.js`)

## Error Handling

**Patterns:**

- Defensive checks on all socket events
- Try/catch in async handlers
- Validation hooks (e.g., `onValidateAction`)

## Logging

**Framework:** Console

**Patterns:**

- Console logs for debug, combat logs for game events

## Comments

**When to Comment:**

- JSDoc-style for public APIs
- Inline comments for complex logic

**JSDoc/TSDoc:**

- Used in architecture docs, not consistently in code

## Function Design

**Size:**

- Small, single-responsibility preferred

**Parameters:**

- Prefer destructuring for config objects

**Return Values:**

- Explicit objects or primitives

## Module Design

**Exports:**

- ES module exports (default and named)

**Barrel Files:**

- Used for champion registry (`shared/data/champions/index.js`)

---

_Convention analysis: 2026-03-25_
