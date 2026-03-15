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
 */
export function addShield(
  champion,
  amount,
  decayPerTurn = 0,
  context,
  type = "regular",
) {
  champion.runtime.shields.push({
    amount,
    decayPerTurn,
    type,
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
 * Checks if shield blocks the current action
 * @param {object} champion - The champion instance
 * @param {object} context - Combat context
 * @returns {boolean}
 */
export function _checkAndConsumeShieldBlock(champion, context) {
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

  // 🛡️ Escudo de Feitiço: bloqueia apenas ações sem contato
  if (context?.currentSkill?.contact === false) {
    const spellIdx = champion.runtime.shields.findIndex(
      (s) => s.type === "spell" && s.amount > 0,
    );
    if (spellIdx !== -1) {
      champion.runtime.shields.splice(spellIdx, 1);
      /* console.log(
        `[Champion] 🛡️ ${champion.name}: Escudo de Feitiço bloqueou a ação sem contato e se dissipou!`,
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
  /* console.log(
    `[Champion] ${champion.name} taunted by ${taunterId}. Will expire at turn ${context.currentTurn + duration}.`,
  );
  */
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
 * @returns {object} Result object
 */
export function applyStatModifier(
  champion,
  { statName, amount, duration = 1, context, isPermanent = false } = {},
) {
  if (!(statName in champion)) {
    console.warn(`Tentativa de modificar stat inexistente: ${statName}`);
    return;
  }

  amount = roundToFive(amount);

  const limits = {
    Critical: { min: 0, max: 95 },
    Evasion: { min: 0, max: 95 },
    default: { min: 10, max: 999 },
  };

  const { min, max } = limits[statName] || limits.default;

  const previous = champion[statName];
  const clamped = Math.max(min, Math.min(previous + amount, max));
  const appliedAmount = clamped - previous;

  champion[statName] = clamped;

  const isCappedMax = amount > 0 && appliedAmount === 0;
  const capLog = isCappedMax ? `O stat ${statName} já está no máximo.` : null;

  const currentTurn = context?.currentTurn ?? 0;

  if (appliedAmount !== 0) {
    champion.statModifiers.push({
      statName: statName,
      amount: appliedAmount,
      expiresAtTurn: currentTurn + duration,
      isPermanent: isPermanent,
    });
  }

  if (appliedAmount > 0 && context?.registerBuff) {
    context.registerBuff({
      target: champion,
      amount: appliedAmount,
      statName,
      sourceId: context.buffSourceId,
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
  } = {},
) {
  if (amount === 0) {
    return { appliedAmount: 0, isCappedMax: false, log: null };
  }

  if (amount > 0) {
    return buffStat(champion, {
      statName,
      amount,
      duration,
      context,
      isPermanent,
      isPercent,
    });
  }

  return debuffStat(champion, {
    statName,
    amount,
    duration,
    context,
    isPermanent,
  });
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
  amount = roundToFive(amount);

  if (amount === 0) {
    return { appliedAmount: 0, isCappedMax: false, log: null };
  }

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
    const nextHP = roundToFive(previousHP + result.appliedAmount);
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
    champion.HP = newHP;
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

  for (const shield of champion.runtime.shields) {
    // Escudos de Feitiço e Supremo não absorvem HP — só bloqueiam ações
    if (shield.type && shield.type !== "regular") continue;
    if (amount <= 0) break;

    const absorbed = Math.min(shield.amount, amount);
    shield.amount -= absorbed;
    amount -= absorbed;
  }

  champion.HP -= amount;
  champion.HP = roundToFive(champion.HP);

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
 * @returns {number} Amount healed
 */
export function heal(champion, amount, context, source = champion) {
  if (!champion.alive) return 0;

  const before = champion.HP;
  champion.HP = Math.min(champion.HP + amount, champion.maxHP);
  const healed = Math.max(0, champion.HP - before);

  const ctx = context || champion.runtime?.currentContext;
  if (healed > 0 && ctx?.registerHeal && !ctx?.suppressHealEvents) {
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
  champion.statModifiers = champion.statModifiers.filter((modifier) => {
    if (modifier.expiresAtTurn <= currentTurn && !modifier.isPermanent) {
      // Revert the stat change only if not permanent
      champion[modifier.statName] -= modifier.amount;
      if (modifier.statName === "maxHP") {
        // Keep current HP in sync with maxHP reverting
        const nextHP = roundToFive(champion.HP - modifier.amount);
        champion.HP = Math.max(0, Math.min(nextHP, champion.maxHP));
      }
      revertedStats.push({
        championId: champion.id,
        statName: modifier.statName,
        revertedAmount: -modifier.amount,
        newValue: champion[modifier.statName],
      });
      /* console.log(
        `[Champion] ${champion.name} ${modifier.statName} reverted by ${-modifier.amount}. New value: ${champion[modifier.statName]}.`,
      );
      */
      return false;
    }
    return modifier.isPermanent || modifier.expiresAtTurn > currentTurn;
  });

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
 * Get all damage modifiers
 * @param {object} champion - The champion instance
 * @returns {array} Damage modifiers
 */
export function getDamageModifiers(champion) {
  return champion.damageModifiers || [];
}
