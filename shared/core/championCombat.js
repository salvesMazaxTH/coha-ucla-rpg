import { formatChampionName } from "../ui/formatters.js";

export function roundToFive(x) {
  return Math.round(x / 5) * 5;
}

/**
 * Apply a shield to the champion
 * @param {object} champion - The champion instance
 * @param {number} amount - Shield amount
 * @param {number} decayPerTurn - Decay per turn
 * @param {object} context - Combat context
 * @param {string} type - Shield type ("regular" | "spell" | "supreme")
 * @param {object} extra - Additional shield fields to persist on runtime
 */
export function addShield(
  champion,
  amount,
  decayPerTurn = 0,
  context,
  type = "regular",
  extra = {},
) {
  champion.runtime.shields.push({
    amount,
    decayPerTurn,
    type,
    ...extra,
  });

  if (context?.registerShield) {
    context.registerShield({ target: champion, amount });
  }

  /* console.log(
    `[Champion] ${champion.name} ganhou um escudo de ${amount} HP (tipo: ${type}) com decaimento de ${decayPerTurn} por turno.`,
  );
  */
}

/**
 * Decays shields at the start of a turn.
 *
 * Two expiry modes are supported:
 *  - Gradual decay:     shield.decayPerTurn > 0  — amount reduced each turn until depleted.
 *  - Instant-at-end:   shield.expiresAtTurn set  — shield stays intact and is removed entirely
 *                       when currentTurn >= expiresAtTurn (checked before gradual decay).
 *
 * Shields with neither field set are permanent (removed only by absorbing damage).
 *
 * @param {object} champion    - The champion instance
 * @param {number} currentTurn - The turn number at the start of which decay is processed
 */
export function decayShields(champion, currentTurn) {
  if (
    !Array.isArray(champion.runtime?.shields) ||
    !champion.runtime.shields.length
  ) {
    return 0;
  }

  let removed = 0;

  champion.runtime.shields = champion.runtime.shields
    .map((shield) => {
      if (!shield) return null;

      // Instant-at-end: shield stays whole until duration expires, then drops entirely.
      if (shield.expiresAtTurn != null && currentTurn != null) {
        if (currentTurn >= shield.expiresAtTurn) {
          removed += 1;
          return null;
        }
        // Not yet expired — skip gradual decay for this shield.
        return shield;
      }

      // Gradual decay: reduce shield amount by decayPerTurn each turn.
      const amount = Number(shield.amount) || 0;
      const decayPerTurn = Number(shield.decayPerTurn) || 0;

      if (amount <= 0 || decayPerTurn <= 0) {
        return shield;
      }

      const nextAmount = amount - decayPerTurn;

      if (nextAmount <= 0) {
        removed += 1;
        return null;
      }

      return {
        ...shield,
        amount: nextAmount,
      };
    })
    .filter(Boolean);

  return removed;
}

/**
 * Checks if shield blocks the current action
 * @param {object} champion - The champion instance
 * @param {object} context - Combat context
 * @param {string} damageType - Damage type for the current event
 * @returns {boolean}
 */
export function _checkAndConsumeShieldBlock(champion, context, damageType) {
  if (!Array.isArray(champion.runtime?.shields)) return false;

  // 🛡️ Escudo Supremo: bloqueia QUALQUER ação
  const supremeIdx = champion.runtime.shields.findIndex(
    (s) => s.type === "supreme" && s.amount > 0,
  );
  if (supremeIdx !== -1) {
    champion.runtime.shields.splice(supremeIdx, 1);
    /* console.log(
      `[Champion] 🛡️ ${champion.name}: Escudo Supremo bloqueou a ação completamente e se dissipou!`,
    );
    */
    return true;
  }

  // 🛡️ Escudo de Feitiço: bloqueia apenas dano mágico
  if (damageType === "magical") {
    const spellIdx = champion.runtime.shields.findIndex(
      (s) => s.type === "spell" && s.amount > 0,
    );
    if (spellIdx !== -1) {
      champion.runtime.shields.splice(spellIdx, 1);
      /* console.log(
      `[Champion] 🛡️ ${champion.name}: Escudo de Feitiço bloqueou o dano mágico e se dissipou!`,
      );
      */
      return true;
    }
  }

  return false;
}

/**
 * Apply taunted effect to champion
 * @param {object} champion - The champion instance
 * @param {string} taunterId - ID of the taunter
 * @param {number} duration - Duration in turns
 * @param {object} context - Combat context
 */
export function applyTaunt(champion, taunterId, duration, context) {
  champion.tauntEffects.push({
    taunterId: taunterId,
    expiresAtTurn: context.currentTurn + duration,
  });
  // Engine-level log and dialog
  const tauntSource = context?.allChampions?.get?.(taunterId);

  const tauntSourceName = tauntSource
    ? formatChampionName(tauntSource)
    : taunterId;

  const logMsg = `${formatChampionName(champion)} foi provocado por <b>${tauntSourceName}</b>.`;

  if (context?.registerDialog) {
    context.registerDialog({
      message: logMsg,
      sourceId: taunterId,
      targetId: champion.id,
    });
  }
  return {
    log: logMsg,
    taunterId,
    targetId: champion.id,
    type: "tauntApply",
  };
}

/**
 * Check if champion is taunted by specific champion
 * @param {object} champion - The champion instance
 * @param {string} taunterId - ID of the taunter
 * @returns {boolean}
 */
export function isTauntedBy(champion, taunterId) {
  return champion.tauntEffects.some((effect) => effect.taunterId === taunterId);
}

/**
 * Apply damage reduction to champion
 * @param {object} champion - The champion instance
 * @param {object} config - Configuration object
 * @param {number} config.amount - Reduction amount
 * @param {number} config.duration - Duration in turns
 * @param {string} config.type - Type ("flat" | "percent")
 * @param {string} config.source - Source description
 * @param {object} config.context - Combat context
 */
export function applyDamageReduction(champion, config = {}) {
  const {
    amount = 0,
    duration = 0,
    type = "flat",
    source = "unknown",
    context,
  } = config;

  if (!context) {
    throw new Error(
      `[applyDamageReduction] chamado sem context (champion: ${champion?.name})`,
    );
  }

  champion.damageReductionModifiers.push({
    amount: amount,
    expiresAtTurn: context.currentTurn + duration,
    type: type,
    source: source,
  });
  console.log(
    `[Champion] ${champion.name} gained ${amount} damage reduction from ${source}. Will expire at turn ${context.currentTurn + duration}.`,
  );
}

/**
 * Get total damage reduction (flat and percent)
 * @param {object} champion - The champion instance
 * @returns {object} { flat, percent }
 */
export function getTotalDamageReduction(champion) {
  let flat = 0;
  let percent = 0;

  for (const mod of champion.damageReductionModifiers) {
    if (mod.type === "percent") {
      percent += mod.amount;
    } else {
      flat += mod.amount;
    }
  }

  return { flat, percent };
}

/**
 * Internal: apply stat modifier
 * @param {object} champion - The champion instance
 * @param {string} statName - Name of the stat
 * @param {number} amount - Amount to modify
 * @param {number} duration - Duration in turns
 * @param {object} context - Combat context
 * @param {boolean} isPermanent - Whether modification is permanent
 * @param {boolean} ignoreMinimum - Whether to ignore the stat minimum clamp
 * @returns {object} Result object
 */
export function applyStatModifier(
  champion,
  {
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    ignoreMinimum = false,
    statModifierSrc = undefined,
  } = {},
) {
  if (!(statName in champion)) {
    throw new Error(`Tentativa de modificar stat inexistente: ${statName}`);
  }

  if (!Number.isFinite(amount)) {
    throw new Error(
      `[applyStatModifier] amount inválido para ${statName}: ${amount}`,
    );
  }

  if (
    statName === "Critical" ||
    statName === "Evasion" ||
    statName === "LifeSteal"
  ) {
    amount = Math.ceil(amount);
  } else {
    amount = roundToFive(amount);
  }

  const limits = {
    Critical: { min: 0, max: 95 },
    Evasion: { min: 0, max: 75 },
    default: { min: 10, max: 999 },
  };

  const { min, max } = limits[statName] || limits.default;

  const previous = champion[statName];
  const effectiveMin = ignoreMinimum ? 0 : min;
  const clamped = Math.max(effectiveMin, Math.min(previous + amount, max));
  const appliedAmount = clamped - previous;

  champion[statName] = clamped;

  const isCappedMax = amount > 0 && appliedAmount === 0;
  const capLog = isCappedMax ? `O stat ${statName} já está no máximo.` : null;

  const currentTurn = context?.currentTurn ?? 0;

  if (amount !== 0) {
    champion.statModifiers.push({
      statName: statName,
      amount: amount,
      ignoreMinimum: ignoreMinimum,
      expiresAtTurn: currentTurn + duration,
      isPermanent: isPermanent,
    });
  }

  if (appliedAmount !== 0 && context?.registerBuff) {
    // fallback: se não passar statModifierSrc, assume o próprio champion
    const src = statModifierSrc !== undefined ? statModifierSrc : champion;
    const resolvedSourceId = _resolveStatModifierSrcId({
      champion,
      context,
      statModifierSrc: src,
      appliedAmount,
    });

    context.registerBuff({
      target: champion,
      amount: appliedAmount,
      statName,
      sourceId: resolvedSourceId,
    });
  }

  /* console.log(
    `[Champion] ${champion.name} teve ${statName} alterado em ${appliedAmount}. ` +
      (isPermanent
        ? "A alteração é permanente e não será revertida."
        : `A alteração será revertida no turno ${currentTurn + duration}.`),
  );
  */
  return {
    appliedAmount,
    isCappedMax,
    log: capLog,
  };
}

/**
 * Buff a stat
 * @param {object} champion - The champion instance
 * @param {object} config - Configuration object
 * @returns {object} Result object
 */
export function buffStat(
  champion,
  {
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    isPercent = false,
    ignoreMinimum = false,
    statModifierSrc = undefined,
  } = {},
) {
  if (!(statName in champion)) {
    console.warn(`Tentativa de modificar stat inexistente: ${statName}`);
    return;
  }

  const normalizedAmount = Math.abs(Number(amount) || 0);

  let effectiveAmount = normalizedAmount;

  if (isPercent) {
    const usesBase = statName !== "HP" && statName !== "maxHP";
    const baseKey = `base${statName}`;
    const baseValue = usesBase ? champion[baseKey] : champion[statName];
    const percentBase = Number.isFinite(baseValue)
      ? baseValue
      : Number.isFinite(champion[statName])
        ? champion[statName]
        : 0;

    effectiveAmount = (percentBase * normalizedAmount) / 100;
  }

  return applyStatModifier(champion, {
    statName,
    amount: effectiveAmount,
    duration,
    context,
    isPermanent,
    ignoreMinimum,
    statModifierSrc,
  });
}

/**
 * Debuff a stat
 * @param {object} champion - The champion instance
 * @param {object} config - Configuration object
 * @returns {object} Result object
 */
export function debuffStat(
  champion,
  {
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    isPercent = false,
    ignoreMinimum = false,
    statModifierSrc = undefined,
  } = {},
) {
  if (!(statName in champion)) {
    console.warn(`Tentativa de modificar stat inexistente: ${statName}`);
    return;
  }

  let effectiveAmount = amount;

  if (isPercent) {
    const usesBase = statName !== "HP" && statName !== "maxHP";
    const baseKey = `base${statName}`;
    const baseValue = usesBase ? champion[baseKey] : champion[statName];
    const percentBase = Number.isFinite(baseValue)
      ? baseValue
      : Number.isFinite(champion[statName])
        ? champion[statName]
        : 0;

    effectiveAmount = (percentBase * amount) / 100;
  }

  return applyStatModifier(champion, {
    statName,
    amount: effectiveAmount,
    duration,
    context,
    isPermanent,
    ignoreMinimum,
    statModifierSrc,
  });
}

/**
 * Modify stat (buff or debuff based on amount sign)
 * @param {object} champion - The champion instance
 * @param {object} config - Configuration object
 * @returns {object} Result object
 */
export function modifyStat(
  champion,
  {
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    isPercent = false,
    ignoreMinimum = false,
    statModifierSrc,
  } = {},
) {
  if (amount === 0) {
    return { appliedAmount: 0, isCappedMax: false, log: null };
  }

  if (amount > 0) {
    // Para buffs, se statModifierSrc não for passado, assume o próprio campeão
    return buffStat(champion, {
      statName,
      amount,
      duration,
      context,
      isPermanent,
      isPercent,
      ignoreMinimum,
      statModifierSrc:
        statModifierSrc !== undefined ? statModifierSrc : champion,
    });
  }

  // Para debuffs, exige statModifierSrc explícito ou context.statModifierSrcId
  if (!statModifierSrc && !context?.statModifierSrcId) {
    throw new Error(
      `[modifyStat] Debuff em ${champion?.name ?? "unknown"} requer statModifierSrc explícito ou context.statModifierSrcId`,
    );
  }

  return debuffStat(champion, {
    statName,
    amount,
    duration,
    context,
    isPermanent,
    isPercent,
    ignoreMinimum,
    statModifierSrc,
  });
}

function _resolveStatModifierSrcId({
  champion,
  context,
  statModifierSrc,
  appliedAmount,
}) {
  if (statModifierSrc && typeof statModifierSrc === "object") {
    return statModifierSrc.id;
  }

  if (
    typeof statModifierSrc === "string" ||
    typeof statModifierSrc === "number"
  ) {
    return statModifierSrc;
  }

  if (appliedAmount > 0) {
    return context?.statModifierSrcId || champion?.id;
  }

  if (context?.statModifierSrcId) {
    return context.statModifierSrcId;
  }

  throw new Error(
    `[modifyStat] Debuff em ${champion?.name ?? "unknown"} requer statModifierSrc explícito ou context.statModifierSrcId`,
  );
}

/**
 * Modify HP (damage, heal, or structural changes)
 * @param {object} champion - The champion instance
 * @param {number} amount - Amount to modify
 * @param {object} config - Configuration object
 * @returns {object} Result object
 */
export function modifyHP(
  champion,
  amount,
  {
    duration = 1,
    context,
    isPermanent = false,
    maxHPOnly = false,
    affectMax = false,
  } = {},
) {
  if (amount === 0) {
    return { appliedAmount: 0, isCappedMax: false, log: null };
  }

  amount = Math.floor(amount);

  // 🔹 Alteração estrutural proporcional (buff real de vida)
  if (affectMax) {
    const previousHP = champion.HP;

    const result =
      amount > 0
        ? buffStat(champion, {
            statName: "maxHP",
            amount,
            duration,
            context,
            isPermanent,
          })
        : debuffStat(champion, {
            statName: "maxHP",
            amount,
            duration,
            context,
            isPermanent,
          });

    // Aplica o mesmo delta ao HP atual
    const nextHP = previousHP + result.appliedAmount;
    champion.HP = Math.max(0, Math.min(nextHP, champion.maxHP));

    return result;
  }
  // 🔹 Apenas altera o teto, sem mexer proporcionalmente
  if (maxHPOnly) {
    return amount > 0
      ? buffStat(champion, {
          statName: "maxHP",
          amount,
          duration,
          context,
          isPermanent,
        })
      : debuffStat(champion, {
          statName: "maxHP",
          amount,
          duration,
          context,
          isPermanent,
        });
  }

  // 🔹 HP atual (cura/dano)
  if (amount > 0) {
    heal(champion, amount, context);
  } else {
    const previous = champion.HP;
    const newHP = Math.max(0, previous + amount);
    champion.HP = Math.floor(newHP);
  }

  return {
    appliedAmount: amount,
    isCappedMax: false,
    log: null,
  };
}

/**
 * Take damage
 * @param {object} champion - The champion instance
 * @param {number} amount - Damage amount
 * @param {object} context - Combat context
 */
export function takeDamage(champion, amount, context) {
  if (!champion.alive) return;

  amount = Math.floor(amount);

  for (const shield of champion.runtime.shields) {
    // Escudos de Feitiço e Supremo não absorvem HP — só bloqueiam ações
    if (shield.type && shield.type !== "regular") continue;
    if (amount <= 0) break;

    const absorbed = Math.min(shield.amount, amount);
    shield.amount -= absorbed;
    amount -= absorbed;
  }

  champion.HP -= amount;

  if (champion.HP <= 0) {
    champion.HP = 0;
    champion.alive = false;
  }
}

/**
 * Heal champion
 * @param {object} champion - The champion instance
 * @param {number} amount - Heal amount
 * @param {object} context - Combat context
 * @param {object} source - Heal source champion
 * @param {object} options - Heal options
 * @returns {number} Amount healed
 */
export function heal(
  champion,
  amount,
  context,
  source = champion,
  options = {},
) {
  if (!champion.alive) return 0;

  const ctx = context || champion.runtime?.currentContext;

  const payload = {
    source,
    target: champion,
    amount,

    context: ctx,

    healType: options?.type || "normal",
    isLifesteal: options?.type === "lifesteal",

    fromTargetId: options?.fromTargetId ?? null,
  };

  // 🔹 Normaliza valor inicial antes dos hooks
  if (payload.amount > 0) {
    payload.amount = Math.max(Math.floor(payload.amount), 1);
  }

  // 🔹 Permite que hooks modifiquem a cura antes dela acontecer
  const beforeResults =
    emitCombatEvent("onBeforeHealing", payload, ctx?.allChampions) || [];

  for (const result of beforeResults) {
    if (!result) continue;

    // 🔹 Override explícito do valor final da cura
    if (typeof result.amount === "number") {
      payload.amount = result.amount;
    }
  }

  // 🔹 Segurança pós-modificações
  payload.amount = Math.max(0, Math.floor(payload.amount));

  amount = payload.amount;

  const before = champion.HP;

  champion.HP = Math.min(champion.HP + amount, champion.maxHP);

  const healed = Math.max(0, champion.HP - before);

  if (healed <= 0) return 0;

  const isLifesteal = options?.type === "lifesteal";

  if (isLifesteal && ctx?.registerLifesteal) {
    ctx.registerLifesteal({
      target: champion,
      amount: healed,
      sourceId: source?.id,
      fromTargetId: options?.fromTargetId ?? null,
    });
  } else if (ctx?.registerHeal) {
    ctx.registerHeal({
      target: champion,
      amount: healed,
      sourceId: source?.id,
    });
  }

  return healed;
}

/**
 * Purge expired stat modifiers
 * @param {object} champion - The champion instance
 * @param {number} currentTurn - Current turn number
 * @returns {array} List of reverted stats
 */
export function purgeExpiredStatModifiers(champion, currentTurn) {
  const revertedStats = [];
  const affectedStats = new Set();
  const remaining = [];

  for (const modifier of champion.statModifiers) {
    if (modifier.expiresAtTurn <= currentTurn && !modifier.isPermanent) {
      affectedStats.add(modifier.statName);
    } else {
      remaining.push(modifier);
    }
  }

  champion.statModifiers = remaining;

  // Recalculate each affected stat from base, reapplying remaining modifiers
  for (const statName of affectedStats) {
    const baseKey = statName === "maxHP" ? "baseHP" : `base${statName}`;
    const baseValue = champion[baseKey];
    if (baseValue === undefined) continue;

    const limits = {
      Critical: { min: 0, max: 95 },
      Evasion: { min: 0, max: 95 },
      default: { min: 10, max: 999 },
    };
    const { max } = limits[statName] || limits.default;

    const previousValue = champion[statName];
    let newValue = baseValue;

    for (const mod of remaining) {
      if (mod.statName === statName) {
        const effectiveMin = mod.ignoreMinimum
          ? 0
          : (limits[statName] || limits.default).min;
        newValue = Math.max(effectiveMin, Math.min(newValue + mod.amount, max));
      }
    }

    champion[statName] = newValue;

    if (statName === "maxHP") {
      champion.HP = Math.max(0, Math.min(champion.HP, champion.maxHP));
    }

    if (previousValue !== newValue) {
      revertedStats.push({
        championId: champion.id,
        statName: statName,
        revertedAmount: newValue - previousValue,
        newValue: newValue,
      });
    }
  }

  champion.tauntEffects = champion.tauntEffects.filter((effect) => {
    if (effect.expiresAtTurn <= currentTurn) {
      /* console.log(
        `[Champion] Taunt effect from ${effect.taunterId} on ${champion.name} expired.`,
      );
      */
      return false;
    }
    return true;
  });

  champion.damageReductionModifiers = champion.damageReductionModifiers.filter(
    (modifier) => {
      if (modifier.expiresAtTurn <= currentTurn) {
        /* console.log(
          `[Champion] Damage reduction of ${modifier.amount} from ${modifier.source} on ${champion.name} expired.`,
        );
        */
        return false;
      }
      return true;
    },
  );

  return revertedStats;
}

/**
 * Add damage modifier
 * @param {object} champion - The champion instance
 * @param {object} mod - Modifier object
 */
export function addDamageModifier(champion, mod) {
  champion.damageModifiers.push(mod);
}

/**
 * Purge expired modifiers
 * @param {object} champion - The champion instance
 * @param {number} currentTurn - Current turn number
 */
export function purgeExpiredModifiers(champion, currentTurn) {
  champion.damageModifiers = champion.damageModifiers.filter((m) => {
    if (m.permanent) return true;
    return m.expiresAtTurn > currentTurn;
  });
}

/**
 * Purge expired runtime hook effects
 * @param {object} champion - The champion instance
 * @param {number} currentTurn - Current turn number
 */
export function purgeExpiredHookEffects(champion, currentTurn) {
  if (!Array.isArray(champion.runtime?.hookEffects)) return;

  champion.runtime.hookEffects = champion.runtime.hookEffects.filter(
    (effect) =>
      effect?.expiresAtTurn === undefined || effect.expiresAtTurn > currentTurn,
  );
}

/**
 * Get all damage modifiers
 * @param {object} champion - The champion instance
 * @returns {array} Damage modifiers
 */
export function getDamageModifiers(champion) {
  return champion.damageModifiers || [];
}
