# Codebase Concerns

**Analysis Date:** 2026-04-21

## Tech Debt

**Switch system partially disabled:**
- Issue: Switch/reserve logic exists but is commented out in multiple places.
- Files: `src/server.js`, `shared/engine/combat/TurnResolver.js`, `shared/engine/match/GameMatch.js`.
- Impact: Risk of inconsistent behavior if re-enabled without full audit.
- Fix approach: Remove dead code or re-enable with full test coverage.

## Known Bugs

- No explicit bug list detected in code (STATE.md contains historical fixes only).

## Security Considerations

**No authentication:**
- Risk: Public server would accept any client without identity checks.
- Files: `src/server.js` (no auth middleware).
- Recommendation: Add authentication or restrict access if deployed publicly.

## Performance Bottlenecks

**Large in-memory state:**
- Problem: All match state stored in memory; no pruning for long sessions.
- Files: `shared/engine/match/GameMatch.js`.
- Improvement path: Add session cleanup or persistence if scaling to multiple matches.

## Fragile Areas

**Combat pipeline complexity:**
- Why fragile: Multi-step pipeline with many hooks and side effects.
- Files: `shared/engine/combat/DamageEvent.js`, `shared/engine/combat/pipeline/*`.
- Safe modification: Update one step at a time, verify event envelope outputs.

## Scaling Limits

**Single-match server:**
- Limit: Global `match` instance supports one match at a time.
- Files: `src/server.js`.
- Scaling path: Support multiple match instances keyed by room.

## Dependencies at Risk

**Express 5.x:**
- Risk: Major version; may have breaking changes if upgrading further.
- Impact: Routing/middleware behavior changes.

## Missing Critical Features

**Persistence:**
- Problem: No persistence for player sessions or matches.
- Impact: Match state lost on restart.
- Implementation complexity: Medium (database + matchmaking layer).

## Test Coverage Gaps

**No automated tests:**
- Risk: Combat changes can regress unnoticed.
- Priority: High for core combat logic.

---

*Concerns audit: 2026-04-21*
*Update as issues are fixed or new ones discovered*