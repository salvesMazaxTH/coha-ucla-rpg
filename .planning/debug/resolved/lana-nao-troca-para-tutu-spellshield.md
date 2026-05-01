---
status: resolved
trigger: "Lana no longer switches to Tutu after passive was changed to grant spellShield to herself"
created: 2026-05-01T00:00:00Z
updated: 2026-05-01T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — `if (owner.HP <= 0) return;` guard in onAfterDmgTaking blocks swap on lethal hits; spellShield silently absorbs magical hits before onAfterDmgTaking fires
test: removed the HP <= 0 early return guard
expecting: swap triggers correctly for all damage scenarios including lethal physical hits
next_action: human verification in-game

## Symptoms

expected: Lana should switch to Tutu normally after taking damage/HP threshold; historically backend switch happened first and UI reflected after turn stabilization
actual: Nothing happens; Lana remains in DOM and backend for the entire match regardless of damage/HP, even on death; dinosaur never replaces her
errors: No console/log errors observed
reproduction: Trigger condition details sparse; reliable symptom is Lana never switches under normal conditions
started: After passive changed to grant spellShield to Lana herself; no other relevant change recalled

## Eliminated

- hypothesis: hookScope missing onTurnStart prevents spellShield grant
  evidence: hookScope is not required for onTurnStart; combatEvents.js only applies scope check when scope is defined. onTurnStart fires correctly for Lana.
  timestamp: 2026-05-01

- hypothesis: allChampions missing from DamageEvent → onAfterDmgTaking can't fire
  evidence: createBaseContext sets allChampions = combat.activeChampions (Map); DamageEvent converts to array. Lana is in activeChampions while un-swapped.
  timestamp: 2026-05-01

- hypothesis: context.requestChampionMutation not available when passive fires
  evidence: TurnResolver.createBaseContext defines requestChampionMutation that pushes to flags.championMutationRequests. These are collected in handleEndTurn and processed after deathResults.
  timestamp: 2026-05-01

## Evidence

- timestamp: 2026-05-01
  checked: DamageEvent.execute() flow
  found: `const earlyExit = preChecks(this); if (earlyExit) return earlyExit;` — when spellShield blocks magical damage, preChecks returns a result object; execute() returns it immediately; runAfterHooks() (which calls onAfterDmgTaking) is never reached.
  implication: Every magical hit absorbed by spellShield means onAfterDmgTaking never fires for that hit → Lana's HP never changes from magical attacks → 35% threshold never crossed from magical sources.

- timestamp: 2026-05-01
  checked: \_checkAndConsumeShieldBlock in championCombat.js
  found: spellShield (type "spell") only blocks when damageType === "magical". Physical damage bypasses the shield entirely.
  implication: Physical damage does reach onAfterDmgTaking. The swap CAN work for physical damage — but only if HP doesn't hit 0.

- timestamp: 2026-05-01
  checked: lana/passive.js onAfterDmgTaking guard
  found: `if (owner.HP <= 0) { return; }` was added as part of the same passive change. When lethal physical damage brings HP to 0 or below, this guard causes an early return BEFORE the threshold check runs.
  implication: Physical lethal damage (one-shot or kill-shot) can never trigger the swap. Combined with spellShield blocking all magical hits, Lana has no code path that successfully swaps her in realistic scenarios.

- timestamp: 2026-05-01
  checked: Threshold check logic after removing the guard
  found: `ratio = owner.HP / owner.maxHP`. If HP = 0, ratio = 0 ≤ 0.35 (threshold). If HP < 0 (overkill), ratio < 0 ≤ 0.35. Both cases correctly pass the threshold check and trigger the swap.
  implication: The HP <= 0 guard was entirely redundant AND harmful. Removing it is safe — the threshold check handles all HP values correctly.

## Resolution

root_cause: `if (owner.HP <= 0) { return; }` guard in `lana/passive.js` `onAfterDmgTaking` was added when the spellShield feature was introduced. It incorrectly aborts the swap trigger when Lana takes lethal damage (HP ≤ 0). The threshold check `ratio > hpThreshold` already handles 0 and negative HP correctly (both yield ratio ≤ 0.35, triggering the swap). Combined with the spellShield absorbing all magical hits before `onAfterDmgTaking` can fire, Lana has no surviving code path that triggers the swap in typical scenarios.
fix: Removed the `if (owner.HP <= 0) { return; }` block from `onAfterDmgTaking` in `shared/data/champions/lana/passive.js`.
verification: confirmed by user in-game — Lana now switches to Tutu correctly after taking damage
files_changed: ["shared/data/champions/lana/passive.js"]
