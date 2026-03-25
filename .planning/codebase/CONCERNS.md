# Codebase Concerns

**Analysis Date:** 2026-03-25

## Tech Debt

**Testing:**

- Issue: No automated tests, only manual test script
- Files: `scripts/test.js`, all logic files
- Impact: Bugs may go undetected, refactors are risky
- Fix approach: Add automated unit/integration tests

**Linting/Formatting:**

- Issue: No linter or formatter config
- Files: All JS files
- Impact: Inconsistent style, harder onboarding
- Fix approach: Add ESLint/Prettier config

**Switch System:**

- Issue: Switch/reserve system is disabled but code remains
- Files: `shared/engine/match/GameMatch.js`, `shared/engine/combat/TurnResolver.js`, client/server logic
- Impact: Dead code, confusion for new devs
- Fix approach: Remove or refactor switch logic

## Known Bugs

**None documented in codebase**

## Security Considerations

**Authentication:**

- Risk: Username-only, no password
- Files: `src/server.js`, `public/js/main.js`
- Current mitigation: None
- Recommendations: Add authentication if needed for production

## Performance Bottlenecks

**None detected in current codebase**

## Fragile Areas

**Combat Pipeline:**

- Files: `shared/engine/combat/DamageEvent.js`, `shared/engine/combat/pipeline/`
- Why fragile: Complex, multi-step, many hooks
- Safe modification: Add tests, document invariants
- Test coverage: None (manual only)

## Scaling Limits

**Sessions:**

- Current capacity: 2 players per match (1v1)
- Limit: No multi-room or scaling logic
- Scaling path: Add room/session management

## Dependencies at Risk

**None detected**

## Missing Critical Features

**Automated Testing:**

- Problem: No test coverage
- Blocks: Safe refactoring, onboarding

## Test Coverage Gaps

**All core logic:**

- What's not tested: Combat, champion, status, turn logic
- Files: All in `shared/`, `src/server.js`
- Risk: Bugs may go unnoticed
- Priority: High

---

_Concerns audit: 2026-03-25_
