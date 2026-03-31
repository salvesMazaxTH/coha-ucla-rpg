# STATE.md

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
