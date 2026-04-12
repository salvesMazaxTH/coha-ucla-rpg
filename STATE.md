## [2026-04-12] Fix/Refactor: Lana <-> Tutu swap/restore via inactiveChampions

- Arquitetura de substituição reestruturada para não reutilizar a mesma instância:
  - `swap`: campeão original sai de `activeChampions` e vai para `inactiveChampions` com estado completo preservado
  - `restore`: campeão original volta de `inactiveChampions` para `activeChampions`
- `replaceChampion` no backend passou a operar em dois modos explícitos (`swap`/`restore`) e ganhou logs de depuração padronizados com prefixo `[REPLACE DEBUG]`
- Correção crítica: no `swap`, o novo campeão criado (ex: Tutu) agora é registrado em `match.combat.activeChampions`; antes era criado mas não entrava no estado autoritativo, causando "slot vazio" no frontend
- Frontend (`processGameStateUpdate`) atualizado para o novo modelo de IDs distintos:
  - sincroniza/cria campeões por snapshot
  - remove do DOM campeões que não existem mais no `gameState` (swapped out)
  - mantém bloco de mismatch de `championKey` para futuras transformações de mesmo ID
- Runtime de vínculo entre substituto e substituído generalizado:
  - removido acoplamento específico `runtime.lana.originalId`
  - novo campo genérico `runtime.swappedFrom` (ID do campeão substituído)
  - passiva do `lana_dino` usa `runtime.swappedFrom` para solicitar `restore`
- Resultado: fluxo Lana -> Tutu -> Lana passa a usar objetos independentes, com restauração limpa do original e sem lógica hardcoded de personagem no servidor
- Patches: `src/server.js`, `shared/engine/match/GameMatch.js`, `shared/data/champions/lana/passive.js`, `shared/data/champions/lana_dino/passive.js`, `public/js/animation/animsAndLogManager.js`

---

## [2026-04-10] Refactor: Score system disabled; win condition now champion-presence-based

- `playerScores` array commented out (`CombatState.reset/resetProgress`); score methods (`addPointForSlot`, `setWinnerScore`, `getScorePayload`) commented out
- New win condition: game ends when a team's `activeChampions` has no entity where `!entityType || entityType === "champion"` — tokens and custom entityTypes do not count toward keeping a player alive
- `computeWinnerSlot()` added to `CombatState` (and delegated in `GameMatch`): uses existing `getAliveChampionsForTeam()`, returns slot of surviving team
- server.js: `MAX_SCORE` commented out; `scoreUpdate` emits, `setWinnerScore` calls, and score-based winner determination replaced with `computeWinnerSlot()`; surrender handler sets `gameEnded = true` directly
- Frontend untouched — `scoreUpdate` events simply no longer fire
- Patch: shared/engine/match/GameMatch.js, src/server.js

---

## [2026-04-06] Fix: Kai gancho_rapido animation always targets middle champion

- Root cause: `camera.updateMatrixWorld()` was never called after setting `camera.position.z = 15` — `Raycaster.setFromCamera()` used a stale identity matrix, so `screenToWorld()` always returned `(0,0,0)` (world center) regardless of the target element's actual screen position
- Fix: Added `camera.updateMatrixWorld()` immediately after positioning the camera, before computing world coordinates
- Patch: public/js/animation/skillAnimations.js

# STATE.md

## [2026-04-06] Fix Eryon passive not triggering on global per-turn ult regen

- Root cause: `applyGlobalTurnRegen` in server.js called `champion.addUlt(...)` directly, bypassing `applyResourceChange` entirely — so no `onResourceGain` event fired, and Eryon's passive never saw the +3 global regen each turn
- Fix: `applyGlobalTurnRegen` now accepts `resolver` param and routes through `resolver.applyResourceChange(...)` when available (direct `addUlt` fallback if no resolver). Call site in `handleStartTurn` passes the existing `resolver` instance.
- Patch: src/server.js

---

## [2026-04-05] Fix buff/debuff indicator detection (damageMod/statMod)

- Root cause: `serialize()` did not include modifier arrays → client champion objects always had empty `statModifiers`/`damageModifiers`/`damageReductionModifiers` → indicators never appeared
- Champion.serialize() now sends `statModifiers` (amount/statName/isPermanent), `damageModifiersCount`, `damageReductionModifiersCount`
- `syncChampionFromSnapshot()` in animsAndLogManager.js now syncs these fields to client champion objects
- StatusIndicator checks both full arrays (server-side) and count fields (client-side)
- Also fixed: code was checking `m.value` instead of `m.amount` on statModifiers
- Removed dead check for negative damageModifiers (all are buff-type with `apply()` pattern)
- Patch: shared/core/Champion.js, shared/ui/statusIndicator.js, public/js/animation/animsAndLogManager.js

---

## [2026-04-05] feat: add Bruno — ice carry champion

- New champion: Bruno (unreleased — `unreleased: true` in data.js)
- Role: carry; HP 315, Atk 320, Def 55 — glass cannon, ice affinity
- Patch: shared/data/champions/bruno/

---

## [2026-04-04] Skill Animation System + Gancho Rápido (Kai)

- Created `public/js/animation/skillAnimations.js`: registry-based system for one-shot skill animations using Three.js WebGL
- `animateSkill(skillKey, { targetEl, userEl })` — plays animation if registered, no-op otherwise
- Registered `gancho_rapido` animation: melee punch effect with swipe trail, fist impact mark (procedural texture), and directional smoke particles
- Renders in `#webgl-container` overlay, computes direction from user→target champion positions, auto-cleans up after 2s lifetime
- Wired into `animsAndLogManager.js` → `processCombatAction()` after action dialog, using `action.skillKey`

---

## [2026-04-03] Ult regen global nerfed

- Global per-turn ult regen reduced (commit `175e4ca`). Exact old→new values not documented in commit message.

---

## [2026-04-02] feat: Lana + Tutu (token) + Torren adicionados

- **Lana**: new champion — HP 305, Atk 220, Def 95, Spd 55.
- **Tutu** (`lana_dino`): token entity (`entityType: "token"`) invocada por Lana via skill effect. HP 180. Não aparece na seleção de time.
- **Torren**: new champion — HP 375, Atk 140, Def 195, Spd 45, Crit 10. Tank role.
- Patches: shared/data/champions/lana/, shared/data/champions/lana_dino/, shared/data/champions/torren/

---: Suppress dialog spam for 'não pode receber congelado' (Nythera bug)

- Fixed: Dialog message for 'não pode receber congelado' or similar is now suppressed if the effect is already present and not stackable (prevents spam when Nythera is present).
- Patch: championStatus.js (applyStatusEffect/\_canApplyStatusEffect)
- Confirmed: No errors after patch

---

## [2026-03-31] Fix sortTeamContainersByCombatSlot — champion DOM order after death

- Added `sortTeamContainersByCombatSlot()` to ensure `.champion` elements in `.team-X` containers are always ordered by logical `combatSlot` after champion removal or creation.
- When a champion dies or is added, DOM order is updated to match logical slot order — keeps actionBar and visual order consistent.
- Also: Ralia ult nerfed (no longer has priority).

---

## [2026-03-30] Dialog system overhaul

- Significant changes to dialog building and displaying logic (commit `eba625d`).
- Improved how combat dialogs are constructed and rendered for champion actions.

---

## [2026-03-29] deathClaim WebGL VFX (Jeff the Death) + SFX & music system

- New VFX: `shared/vfx/deathClaim.js` — cinematográfico WebGL effect for Jeff's ult "A Morte O Reclama". Full-screen canvas, independent of skillAnimations system.
- New system: `public/js/utils/AudioManager.js` — singleton managing SFX (heal, damage, victory, defeat) and background music (main, main2 playlist). Supports independent volume/enable controls per category and a master `globalVolume` multiplier.
- Integrated into `main.js` (preload + UI sliders/toggles) and `animsAndLogManager.js` (combat SFX triggers).

---

## [2026-03-27] feat: Eryon adicionado

- New champion: Eryon — HP 330, Atk 95, Def 130, Spd 75. Support/utility role.
- Passive: Ressonância Eryônica — acumula stacks ao longo da partida via hooks `onResourceGain`/`onResourceSpend` de aliados e inimigos.
- Patch: shared/data/champions/eryon/
