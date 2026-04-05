# STATE.md

## [2026-04-05] Fix buff/debuff indicator detection (damageMod/statMod)

- Root cause: `serialize()` did not include modifier arrays → client champion objects always had empty `statModifiers`/`damageModifiers`/`damageReductionModifiers` → indicators never appeared
- Champion.serialize() now sends `statModifiers` (amount/statName/isPermanent), `damageModifiersCount`, `damageReductionModifiersCount`
- `syncChampionFromSnapshot()` in animsAndLogManager.js now syncs these fields to client champion objects
- StatusIndicator checks both full arrays (server-side) and count fields (client-side)
- Also fixed: code was checking `m.value` instead of `m.amount` on statModifiers
- Removed dead check for negative damageModifiers (all are buff-type with `apply()` pattern)
- Patch: shared/core/Champion.js, shared/ui/statusIndicator.js, public/js/animation/animsAndLogManager.js

---

## [2026-04-04] Skill Animation System + Gancho Rápido (Kai)

- Created `public/js/animation/skillAnimations.js`: registry-based system for one-shot skill animations using Three.js WebGL
- `animateSkill(skillKey, { targetEl, userEl })` — plays animation if registered, no-op otherwise
- Registered `gancho_rapido` animation: melee punch effect with swipe trail, fist impact mark (procedural texture), and directional smoke particles
- Renders in `#webgl-container` overlay, computes direction from user→target champion positions, auto-cleans up after 2s lifetime
- Wired into `animsAndLogManager.js` → `processCombatAction()` after action dialog, using `action.skillKey`

---

## [2026-03-31] GSD Quick Task: Suppress dialog spam for 'não pode receber congelado' (Nythera bug)

- Fixed: Dialog message for 'não pode receber congelado' or similar is now suppressed if the effect is already present and not stackable (prevents spam when Nythera is present).
- Patch: championStatus.js (applyStatusEffect/\_canApplyStatusEffect)
- Confirmed: No errors after patch

---

- Added sortTeamContainersByCombatSlot() to ensure .champion elements in .team-X containers are always ordered by logical combatSlot after champion removal or creation.
- Now, when a champion dies or is added, the DOM order is updated to match the logical slot order, keeping actionBar and visual order consistent.
- Fix tested: Jeff (or any champion) remains in the correct DOM slot matching their logical slot after death.

---

- [x] Atomic commit
- [x] Quick GSD task
- [x] No errors after patch
- [x] STATE.md updated
