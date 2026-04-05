# STATE.md

## [2026-04-05] Fix buff/debuff indicator detection (damageMod/statMod)

- Fixed: buff/debuff arrow indicators never appeared because code checked `m.value` but modifiers use `m.amount` (statModifiers, damageReductionModifiers) or `apply()` functions (damageModifiers)
- statModifiers: now checks `m.amount > 0` (buff) / `m.amount < 0` (debuff)
- damageModifiers: presence = buff (all use `apply()` pattern, no simple value)
- damageReductionModifiers: presence = buff (reduces incoming damage)
- Removed dead check for negative damageModifiers (none exist in codebase)
- Patch: shared/ui/statusIndicator.js

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
