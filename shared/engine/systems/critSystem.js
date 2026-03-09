const DEFAULT_CRIT_BONUS = 55;
const MAX_CRIT_CHANCE = 95;

import { emitCombatEvent } from "../combatEvents.js";

export function processCrit(event, debugMode) {
  if (debugMode) {
    console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${event.damage}`);
  }

  const chance = Math.min(event.attacker?.Critical || 0, MAX_CRIT_CHANCE);

  event.crit = {
    chance,
    didCrit: false,
    bonus: 0,
    roll: null,
    forced: false,
  };

  if (chance > 0 || event.critOptions?.force || event.critOptions?.disable) {
    const rolled = _rollCrit(
      event.attacker,
      event.context,
      event.critOptions,
      debugMode,
    );

    if (rolled) Object.assign(event.crit, rolled);
  }

  const critBonusFactor = event.crit.bonus / 100;
  const critExtra = event.damage * critBonusFactor;

  event.crit.critBonusFactor = critBonusFactor;
  event.crit.critExtra = critExtra;
  if (debugMode) {
    console.log(
      `[DAMAGE COMPOSITION] 💥 Dano extra de crítico: ${critExtra.toFixed(2)}`,
    );
  }

  if (event.crit.didCrit) {
    emitCombatEvent(
      "onCriticalHit",
      {
        attacker: event.attacker,
        critSrc: event.attacker,
        target: event.target,
        context: event.context,
        forced: event.crit.forced,
      },
      event.context?.allChampions,
    );
  }

  if (debugMode) console.groupEnd();
}

function _rollCrit(user, context, critOptions = {}, debugMode = false) {
  const { force = false, disable = false } = critOptions;

  const chance = Math.min(user?.Critical || 0, MAX_CRIT_CHANCE);
  const bonus = user?.critBonusOverride || DEFAULT_CRIT_BONUS;

  if (disable) {
    return {
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
      disabled: true,
    };
  }

  if (force) {
    return {
      didCrit: true,
      bonus,
      roll: null,
      forced: true,
      disabled: false,
    };
  }

  const roll = Math.random() * 100;

  const didCrit = context?.editMode?.alwaysCrit ? true : roll < chance;

  if (debugMode) {
    console.log(`[CRIT]🎯 Roll: ${roll.toFixed(2)}`);
    console.log(`[CRIT]🎲 Chance necessária: ${chance}%`);
    console.log(didCrit ? "[CRIT]✅ CRÍTICO!" : "[CRIT]❌ Sem crítico");
    console.log(`[CRIT]➕ Bônus de crítico: ${bonus}%`);
  }

  return {
    didCrit,
    bonus: didCrit ? bonus : 0,
    roll,
    forced: false,
    disabled: false,
  };
}
