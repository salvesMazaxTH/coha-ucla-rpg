# STATE.md

## [2026-03-31] GSD Quick Task: Fix DOM/logic slot mismatch after champion death

- Added sortTeamContainersByCombatSlot() to ensure .champion elements in .team-X containers are always ordered by logical combatSlot after champion removal or creation.
- Now, when a champion dies or is added, the DOM order is updated to match the logical slot order, keeping actionBar and visual order consistent.
- Fix tested: Jeff (or any champion) remains in the correct DOM slot matching their logical slot after death.

---

- [x] Atomic commit
- [x] Quick GSD task
- [x] No errors after patch
- [x] STATE.md updated
