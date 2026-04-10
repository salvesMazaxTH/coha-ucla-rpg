# Quick Task 260410-kjf — Comment score refs + new win condition (backend only)

**Created:** 2026-04-10
**Status:** planned

## Goal

Comment out all player-score/points machinery from the backend (`shared/` + `src/server.js`)
and replace the win condition: a player loses when **no entity** in their `activeChampions`
satisfies `!entityType || entityType === "champion"` — tokens and other non-champion entity
types do NOT count toward keeping the player alive.

---

## Task 1 — GameMatch.js: disable score system + add real-champion win condition

**File:** `shared/engine/match/GameMatch.js`

### Changes

1. `CombatState.reset()` — comment out `this.playerScores = [0, 0];`
2. `CombatState.resetProgress()` — comment out `this.playerScores = [0, 0];`
3. `removeChampionFromGame()` — comment out entire scoring block (`isToken`, `scoringTeam`, `scoringPlayerSlot`, `scored`, `addPointForSlot` call) and all related `console.log`s; keep the death-log and `removeChampion` call.
4. `removeChampionFromGame()` — add new win-condition check after `this.removeChampion(championId)`: set `this.gameEnded = true` if dying team has no real champions left.
5. `removeChampionFromGame()` — remove `scored`, `scoringTeam`, `scoringPlayerSlot` from return object (or comment them out).
6. Add helper `hasRealChampionForTeam(team)` to `CombatState`.
7. Add helper `computeWinnerSlot()` to `CombatState` (returns slot 0/1 of team that still has real champions).
8. Comment out `addPointForSlot()` method body.
9. Comment out `setWinnerScore()` method body.
10. Comment out `getScorePayload()` method body.
11. `GameMatch` delegation layer — comment out `addPointForSlot`, `setWinnerScore`, `getScorePayload` delegations.
12. `GameMatch` delegation layer — add `hasRealChampionForTeam(team)` and `computeWinnerSlot()` delegations.

### must_haves

- `playerScores` array is never mutated after this change
- `gameEnded` is set to `true` when the dying team's last real champion is removed
- A team with only tokens remaining triggers `gameEnded`
- `hasRealChampionForTeam`: entity qualifies as "real" iff `!entityType || entityType === "champion"`

---

## Task 2 — server.js: update score references + winner determination

**File:** `src/server.js`

### Changes

1. Line ~48: Comment out `const MAX_SCORE = 3;`
2. `emitChampionDeath()` — comment out `if (deathResult.scored)` block (skips `scoreUpdate` + combatLog point)
3. Turn resolution `isGameEnded()` check — replace `match.combat.playerScores[0] >= MAX_SCORE ? 0 : 1` with `match.combat.computeWinnerSlot()`
4. `removeChampion` socket handler — same winner-slot replacement
5. Line ~1124: Comment out `io.emit("scoreUpdate", match.getScorePayload());` (initial game-start emit)
