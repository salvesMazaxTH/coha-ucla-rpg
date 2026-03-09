import { emitCombatEvent } from "../combatEvents.js";

// ============================================================================
// AFFINITY SYSTEM
// ============================================================================

const ELEMENT_CYCLE = ["fire", "ice", "earth", "lightning", "water"];

function applyAffinity(event, debugMode) {
  const skillElement = event.skill?.element;

  if (!skillElement) return;
  if (!event.defender?.elementalAffinities?.length) return;

  if (debugMode) {
    console.log("🔥 _applyAffinity chamado:", {
      skillElement,
      defender: event.defender.name,
      affinities: event.defender.elementalAffinities,
      damage: event.damage,
    });
  }

  let strongestRelation = "neutral";

  for (const affinity of event.defender.elementalAffinities) {
    const relation = _getElementalRelation(skillElement, affinity);

    if (relation === "weak") {
      event.damage = Math.floor(event.damage * 1.2 + 25);
      strongestRelation = "weak";
      break;
    }

    if (relation === "resist" && strongestRelation !== "weak") {
      event.damage = Math.max(event.damage - 40, 0);
      strongestRelation = "resist";
      break;
    }
  }

  if (strongestRelation !== "neutral") {
    const message =
      strongestRelation === "weak"
        ? "✨ É SUPER-EFETIVO!"
        : "🛡️ Não é muito efetivo...";

    event.context.visual.dialogEvents ??= [];
    event.context.visual.dialogEvents.push({
      type: "dialog",
      message,
      blocking: false,
    });
  }

  event.context.ignoreMinimumFloor = true;
}

function _getElementalRelation(attackingElement, defendingElement) {
  const cycle = ELEMENT_CYCLE;

  const index = cycle.indexOf(attackingElement);

  if (index === -1) return "neutral";

  const strongAgainst = cycle[(index + 1) % cycle.length];
  const weakAgainst = cycle[(index - 1 + cycle.length) % cycle.length];

  if (defendingElement === strongAgainst) return "weak";

  if (defendingElement === weakAgainst) return "resist";

  return "neutral";
}

// ============================================================================
// CRIT SYSTEM
// ============================================================================

const DEFAULT_CRIT_BONUS = 55;
const MAX_CRIT_CHANCE = 95;

function processCrit(event, debugMode) {
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
        source: event.attacker,
        critSrc: event.attacker,
        target: event.defender,
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

// ============================================================================
// MODIFIER SYSTEM
// ============================================================================

function applyDamageModifiers(event, debugMode) {
  if (!event.attacker?.getDamageModifiers) {
    if (debugMode) {
      console.log(`⚠️ [MODIFIERS] Nenhum modificador de dano disponível`);
    }
    return;
  }

  if (debugMode) {
    console.group(`🔧 [DAMAGE MODIFIERS]`);
    console.log(`📍 Damage Inicial: ${event.damage}`);
  }

  event.attacker.purgeExpiredModifiers(event.context.currentTurn);

  const modifiers = event.attacker.getDamageModifiers();

  if (debugMode) {
    console.log(`🎯 Total de modificadores: ${modifiers.length}`);
  }

  if (!Array.isArray(modifiers)) {
    throw new Error(
      `getDamageModifiers deve retornar um array, mas recebeu: ${modifiers}`,
    );
  }

  for (let i = 0; i < modifiers.length; i++) {
    const mod = modifiers[i];

    if (debugMode) {
      console.log(
        `  └─ Modifier ${i + 1}: name='${mod.name || "Unknown"}' | damage=${event.damage}`,
      );
    }

    if (mod.apply) {
      const oldDamage = event.damage;

      const out = mod.apply({
        baseDamage: event.damage,
        attacker: event.attacker,
        defender: event.defender,
        skill: event.skill,
      });

      if (typeof out === "number") {
        event.damage = out;

        if (debugMode) {
          console.log(
            `     ✏️ Aplicado: ${oldDamage} → ${event.damage} (Δ ${event.damage - oldDamage})`,
          );
        }
      }
    }
  }

  if (debugMode) {
    console.log(`📊 Damage Final: ${event.damage}`);
    console.groupEnd();
  }
}

// ============================================================================
// MAIN PIPELINE STEP
// ============================================================================

export function prepareDamage(event) {
  if (event.mode === event.constructor.Modes.ABSOLUTE) return;
  const debug = event.constructor.debugMode;
  // ordem importa
  // crit -> modifiers -> affinity
  processCrit(event, debug);

  applyDamageModifiers(event, debug);

  applyAffinity(event, debug);
}
