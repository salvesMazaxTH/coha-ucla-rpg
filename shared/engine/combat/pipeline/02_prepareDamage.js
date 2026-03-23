// ============================================================================
// AFFINITY SYSTEM
// ============================================================================

const ELEMENTAL_MATRIX = {
  steel: {
    weakTo: ["fire"],
    resists: ["air", "ice"],
  },

  earth: {
    weakTo: ["water"],
    resists: ["lightning", "fire"],
  },

  fire: {
    weakTo: ["water", "earth"],
    resists: ["ice", "air"],
  },

  water: {
    weakTo: ["lightning", "ice"],
    resists: ["fire"],
  },

  lightning: {
    weakTo: ["earth"],
    resists: ["air"],
  },

  air: {
    weakTo: ["fire", "ice"],
    resists: ["earth"],
  },

  ice: {
    weakTo: ["fire", "steel"],
    resists: ["water"],
  },
};

function applyAffinity(event, debugMode) {
  const skillElement = event.skill?.element;

  if (!skillElement) return;

  const defenderElements = event.defender?.elementalAffinities || [];
  if (!defenderElements.length) return;

  if (debugMode) {
    console.log("🔥 _applyAffinity chamado:", {
      skillElement,
      defender: event.defender.name,
      affinities: event.defender.elementalAffinities,
      damage: event.damage,
    });
  }

  let multiplier = 1;
  let weakCount = 0;
  let resistCount = 0;

  for (const defEl of defenderElements) {
    const relation = ELEMENTAL_MATRIX[defEl];

    if (!relation) continue;

    if (relation.weakTo?.includes(skillElement)) {
      multiplier *= 1.675;
      weakCount++;
    }

    if (relation.resists?.includes(skillElement)) {
      multiplier *= 0.6;
      resistCount++;
    }
  }

  const EPSILON = 0.01;

  if (Math.abs(multiplier - 1) < EPSILON) return;

  event.damage *= multiplier;
  if (multiplier > 1) {
    event.context.registerDialog({
      message: "✨ É SUPER-EFETIVO!",
      blocking: false,
    });
  } else if (resistCount < 1) {
    event.context.registerDialog({
      message: "🛡️ Não é muito efetivo...",
      blocking: false,
    });
  }

  if (debugMode) {
    console.log("🔥 applyAffinity RESULT:", {
      skillElement,
      defender: event.defender.name,
      multiplier,
      weakCount,
      resistCount,
      finalDamage: event.damage,
    });
  }
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
    console.log(`📊 Damage Final: ${event.damage.toFixed(2)}`);
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
