# Quick Task 260410-kjf — Summary

**Completed:** 2026-04-10
**Status:** done

## What changed

### `shared/engine/match/GameMatch.js` (`CombatState`)

- Commented out `this.playerScores = [0, 0]` in both `reset()` and `resetProgress()`
- Comment out the entire score block inside `removeChampionFromGame()` (was: isToken check, `addPointForSlot`, combatLog messages)
- **New win condition** after `this.removeChampion(championId)`: sets `this.gameEnded = true` when `getAliveChampionsForTeam(dyingTeam).some(isRealChampion)` returns false — where `isRealChampion` = `!entityType || entityType === "champion"`. Tokens and entities with any other `entityType` do **not** count.
- Commented out `addPointForSlot()`, `setWinnerScore()`, `getScorePayload()` method bodies
- Added `computeWinnerSlot()` method: iterates teams 1→2 and returns the slot of the team that still has a real champion alive (uses existing `getAliveChampionsForTeam`)
- No new helpers added — the `isRealChampion` predicate is inlined at the two call sites

### `GameMatch` delegation layer (same file)

- Commented out `addPointForSlot`, `setWinnerScore`, `getScorePayload` delegations
- Added `computeWinnerSlot()` delegation

### `src/server.js`

- Commented out `const MAX_SCORE = 3`
- `emitChampionDeath()`: commented out `scoreUpdate` emit + point combatLog inside `if (deathResult.scored)`
- Turn-resolution game-over check: replaced `playerScores[0] >= MAX_SCORE ? 0 : 1` with `match.combat.computeWinnerSlot()`
- `removeChampion` socket handler: same replacement
- `surrender` handler: replaced `match.setWinnerScore(…, MAX_SCORE)` + `scoreUpdate` emit with `match.combat.gameEnded = true`
- Game-start: commented out initial `io.emit("scoreUpdate", …)`

## What was NOT changed

- Frontend (`public/`) is untouched — `scoreUpdate` socket events simply won't fire anymore, but no client code was modified
- Architecture docs in `readme/` were not updated (they describe the old score system)
