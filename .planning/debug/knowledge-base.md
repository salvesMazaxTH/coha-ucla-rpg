# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## lana-nao-troca-para-tutu-spellshield — swap to Tutu never triggers after spellShield passive added

- **Date:** 2026-05-01
- **Error patterns:** swap, tutu, spellShield, onAfterDmgTaking, HP <= 0, never triggers, no swap, threshold, passive
- **Root cause:** `if (owner.HP <= 0) { return; }` guard in `onAfterDmgTaking` aborted the threshold check on lethal hits. Combined with spellShield silently absorbing all magical hits before `onAfterDmgTaking` fires (DamageEvent preChecks early-exit), Lana had no surviving code path to trigger the swap in typical scenarios.
- **Fix:** Removed the `if (owner.HP <= 0) { return; }` block from `onAfterDmgTaking`. The threshold ratio check (`owner.HP / owner.maxHP <= hpThreshold`) already handles 0 and negative HP correctly.
- **Files changed:** shared/data/champions/lana/passive.js

---
