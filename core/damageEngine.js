import { formatChampionName } from "./formatters.js";
import { emitCombatEvent } from "./combatEvents.js";

const editMode = false;
const debugMode = false;

const DEFAULT_CRIT_BONUS = 55;
const MAX_CRIT_CHANCE = 95;

export const DamageEngine = {
  roundToFive(x) {
    return Math.round(x / 5) * 5;
  },

  // -------------------------------------------------
  // Crit. related

  rollCrit(user, context, options = {}) {
    const { force = false, disable = false } = options;

    const chance = Math.min(user.Critical || 0, MAX_CRIT_CHANCE);
    const bonus = user.critBonusOverride || DEFAULT_CRIT_BONUS;

    let didCrit = false;
    let roll = null;

    if (disable) {
      if (debugMode) {
        console.log(`🚫 CRÍTICO BLOQUEADO`);
      }

      return {
        didCrit: false,
        bonus: 0,
        roll: null,
        forced: false,
        disabled: true,
      };
    }

    if (force) {
      if (debugMode) {
        console.log(`✅ CRÍTICO FORÇADO`);
      }

      return {
        didCrit: true,
        bonus,
        roll: null,
        forced: true,
        disabled: false,
      };
    }

    /*   roll = Math.random() * 100; // Descomente para uso normal */
    roll = 10; // Descomente para teste fixo
    didCrit = roll < chance;

    if (debugMode) {
      console.log(`🎯 Roll: ${roll.toFixed(2)}`);
      console.log(`🎲 Chance necessária: ${chance}%`);
      console.log(`${didCrit ? "✅ CRÍTICO!" : "❌ Sem crítico"}`);
    }

    return {
      didCrit,
      bonus: didCrit ? bonus : 0,
      roll,
      forced: false,
      disabled: false,
    };
  },

  processCrit({ baseDamage, user, target, context, options = {} }) {
    if (debugMode)
      console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${baseDamage}`);

    let crit = {
      chance: Math.min(user?.Critical || 0, MAX_CRIT_CHANCE),
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };

    if (debugMode) {
      console.log(`👤 Critical Chance: ${crit.chance}%`);
      console.log(
        `🎯 Options: Force=${options.force}, Disable=${options.disable}`,
      );
    }

    if (crit.chance > 0 || options.force || options.disable) {
      crit = this.rollCrit(user, context, options);
      if (debugMode) console.log(`🎲 Roll Result:`, crit);
    }

    const critBonusFactor = crit.bonus / 100;
    const critExtra = baseDamage * critBonusFactor;

    if (debugMode) {
      console.log(`📊 Crit Bonus Factor: ${critBonusFactor} (${crit.bonus}%)`);
      console.log(`💥 Extra Damage from Crit: ${critExtra}`);
      console.log(`✅ Did Crit: ${crit.didCrit}`);
    }

    if (crit.didCrit && user?.passive?.onCriticalHit) {
      if (debugMode) console.log(`🔥 Executando passiva onCriticalHit`);
      user.passive.onCriticalHit({
        user,
        target,
        context,
        forced: crit.forced,
      });
    }

    crit.critBonusFactor = critBonusFactor;
    crit.critExtra = critExtra;

    if (debugMode) console.groupEnd();

    return crit;
  },

  // -------------------------------------------------

  // -----------------------------------
  // Cálculo e aplicação de dano e seus métodos auxiliares

  // Modificadores
  _applyDamageModifiers(damage, user, target, skill, context) {
    if (!user?.getDamageModifiers) {
      if (debugMode)
        console.log(`⚠️ [MODIFIERS] Nenhum modificador de dano disponível`);
      return damage;
    }

    if (debugMode) console.group(`🔧 [DAMAGE MODIFIERS]`);
    if (debugMode) console.log(`📍 Damage Inicial: ${damage}`);

    user.purgeExpiredModifiers(context.currentTurn);

    const modifiers = user.getDamageModifiers();
    if (debugMode)
      console.log(`🎯 Total de modificadores: ${modifiers.length}`);

    for (let i = 0; i < modifiers.length; i++) {
      const mod = modifiers[i];
      if (debugMode) {
        console.log(
          `  └─ Modifier ${i + 1}: name='${mod.name || "Unknown"}' | damage=${damage}`,
        );
      }

      if (mod.apply) {
        const oldDamage = damage;
        const out = mod.apply({ baseDamage: damage, user, target, skill });
        if (typeof out === "number") {
          damage = out;
          if (debugMode) {
            console.log(
              `     ✏️ Aplicado: ${oldDamage} → ${damage} (Δ ${damage - oldDamage})`,
            );
          }
        }
      }
    }

    if (debugMode) {
      console.log(`📊 Damage Final: ${damage}`);
      console.groupEnd();
    }

    return damage;
  },

  defenseToPercent(defense) {
    if (debugMode) console.group(`🛡️ [DEFENSE DEBUG]`);

    if (!defense) {
      if (debugMode) {
        console.log(`Defense: ${defense} (ou 0)`);
        console.log(`Redução percentual: 0%`);
        console.groupEnd();
      }
      return 0;
    }

    // --- Curva alvo (suave, interpolada) ---
    const curve = {
      0: 0.0,
      35: 0.25,
      60: 0.37,
      85: 0.52,
      110: 0.6,
      125: 0.65,
      150: 0.75,
    };

    const keys = Object.keys(curve)
      .map(Number)
      .sort((a, b) => a - b);

    let effective;

    if (defense <= keys[0]) {
      effective = curve[keys[0]];
    } else if (defense >= keys[keys.length - 1]) {
      effective = curve[keys[keys.length - 1]];
    } else {
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];

        if (defense >= a && defense <= b) {
          const t = (defense - a) / (b - a);
          effective = curve[a] + t * (curve[b] - curve[a]);
          break;
        }
      }
    }

    if (debugMode) {
      console.log(`Defense original: ${defense}`);
      console.log(`Redução interpolada: ${(effective * 100).toFixed(2)}%`);
      console.log(`Dano que PASSA: ${((1 - effective) * 100).toFixed(2)}%`);
      console.groupEnd();
    }

    return effective;
  },

  _composeFinalDamage(mode, damage, crit, direct, target, context) {
    if (debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);

    const baseDefense = target.baseDefense ?? target.Defense;
    const currentDefense = target.Defense;

    // ⭐ crítico ignora buffs de defesa
    const defenseUsed = crit.didCrit
      ? Math.min(baseDefense, currentDefense)
      : currentDefense;

    if (debugMode) {
      console.log(`📍 Damage Base: ${damage}`);
      console.log(`🎯 Mode: ${mode}`);
      console.log(`🛡️ Defesa base: ${baseDefense}`);
      console.log(`🛡️ Defesa atual: ${currentDefense}`);
      console.log(`➡️ Defesa usada: ${defenseUsed}`);

      if (crit.didCrit) {
        console.log(`💥 Crítico ativo`);
        console.log(`➡️ Buffs de defesa ignorados`);
        console.log(`   Crit Extra: ${crit.critExtra}`);
        console.log(`   Crit Bonus Factor: ${crit.critBonusFactor}`);
      }

      console.log(`📦 Direct Damage solicitado: ${direct}`);
    }

    // --- aplica crítico ---
    let finalDamage = crit.didCrit ? damage + crit.critExtra : damage;

    if (editMode) {
      if (debugMode) {
        console.log(`🔴 EDIT MODE → 999`);
        console.groupEnd();
      }
      return 999;
    }

    const defensePercent = this.defenseToPercent(defenseUsed);
    const flatReduction = target.getTotalDamageReduction?.() || 0;

    // ---------- RAW ----------
    if (mode === "raw") {
      finalDamage = Math.max(
        finalDamage - finalDamage * defensePercent - flatReduction,
        0,
      );
    }
    // ---------- HYBRID ----------
    else {
      const directPortion = Math.min(direct, finalDamage);
      const rawPortion = finalDamage - directPortion;

      const directAfterReduction = Math.max(directPortion - flatReduction, 0);

      const rawAfterReduction = Math.max(
        rawPortion - rawPortion * defensePercent - flatReduction,
        0,
      );

      finalDamage = directAfterReduction + rawAfterReduction;
    }

    // ---------- FINALIZAÇÃO ----------
    finalDamage = Math.max(finalDamage, 10);
    finalDamage = this.roundToFive(finalDamage);

    if (debugMode) {
      console.log(`📈 Final: ${finalDamage}`);
      console.groupEnd();
    }

    return finalDamage;
  },

  _applyDamage(target, val, context) {
    if (debugMode) console.group(`❤️ [APLICANDO DANO]`);
    if (debugMode) {
      console.log(`👤 Target: ${target.name}`);
      console.log(`📍 HP Antes: ${target.HP}/${target.maxHP}`);
      console.log(`💥 Dano: ${val}`);
    }

    const hpBefore = target.HP;

    target.takeDamage(val, context);

    const hpAfter = target.HP;
    const actualDmg = hpBefore - hpAfter;

    if (debugMode) {
      console.log(`📍 HP Depois: ${hpAfter}/${target.maxHP}`);
      console.log(`✅ Dano efetivo: ${actualDmg}`);
      if (hpAfter <= target.maxHP * 0.2)
        console.log(`🚨 ALERTA: Target em perigo! (<20% HP)`);
      if (hpAfter <= 0) console.log(`💀 Target DERROTADO!`);
      console.groupEnd();
    }

    return hpAfter;
  },

  _applyBeforeTakingPassive(
    mode,
    damage,
    crit,
    attacker,
    target,
    context,
    allChampions,
  ) {
    const results = emitCombatEvent(
      "beforeDamageTaken",
      {
        mode,
        damage,
        crit,
        attacker,
        target,
        context,
      },
      allChampions,
    );

    const logs = [];

    for (const r of results) {
      if (r.damage !== undefined) damage = r.damage;

      if (r.crit !== undefined) crit = r.crit;

      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }
    }

    return { damage, crit, logs };
  },

  _applyBeforeDealingPassive(
    mode,
    damage,
    crit,
    attacker,
    target,
    context,
    allChampions,
  ) {
    const results = emitCombatEvent(
      "beforeDamageDealt",
      {
        mode,
        damage,
        crit,
        attacker,
        target,
        context,
      },
      allChampions,
    );

    const logs = [];

    for (const r of results) {
      if (r.damage !== undefined) damage = r.damage;

      if (r.crit !== undefined) crit = r.crit;

      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }
    }

    return { damage, crit, logs };
  },

  _applyAfterTakingPassive(
    attacker,
    target,
    damage,
    mode,
    crit,
    context,
    allChampions,
  ) {
    const results = emitCombatEvent(
      "afterDamageTaken",
      {
        attacker,
        target,
        damage,
        mode,
        crit,
        context,
      },
      allChampions,
    );

    const logs = [];

    for (const r of results) {
      if (!r) continue;

      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }
    }

    return logs;
  },

  _applyAfterDealingPassive(
    attacker,
    target,
    damage,
    mode,
    crit,
    context,
    allChampions,
  ) {
    const results = emitCombatEvent(
      "afterDamageDealt",
      {
        attacker,
        target,
        damage,
        mode,
        crit,
        context,
      },
      allChampions,
    );

    const logs = [];

    for (const r of results) {
      if (!r) continue;

      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }
    }

    return logs;
  },

  // -----------------------------------

  _buildLog(user, target, skill, dmg, crit, hpAfter) {
    const userName = formatChampionName(user);
    const targetName = formatChampionName(target);

    let log = `${userName} usou ${skill} e causou ${dmg} de dano a ${targetName}`;

    if (crit.didCrit)
      log += ` (CRÍTICO ${(1 + crit.critBonusFactor).toFixed(2)}x)`;

    log += `\nHP final de ${targetName}: ${hpAfter}/${target.maxHP}`;

    return log;
  },

  _applyLifeSteal(user, dmg, allChampions = []) {
    if (debugMode) console.group(`💉 [LIFESTEAL]`);

    if (user.LifeSteal <= 0 || dmg <= 0) {
      if (debugMode) {
        console.log(`⚠️ Sem lifesteal: LS=${user.LifeSteal}%, DMG=${dmg}`);
        console.groupEnd();
      }
      return;
    }

    const heal = Math.max(5, this.roundToFive((dmg * user.LifeSteal) / 100));

    if (debugMode) {
      console.log(`👤 Attacker: ${user.name}`);
      console.log(`📊 Damage causado: ${dmg}`);
      console.log(`💚 Heal final: ${heal}`);
    }

    user.heal(heal);

    // ================================
    // 🔥 EVENT PIPELINE (CORRIGIDO)
    // ================================

    const results = emitCombatEvent(
      "onLifeSteal",
      {
        source: user,
        amount: heal,
      },
      allChampions,
    );

    const passiveLogs = [];

    for (const r of results) {
      if (!r) continue;

      if (r.log) {
        if (Array.isArray(r.log)) passiveLogs.push(...r.log);
        else passiveLogs.push(r.log);
      }
    }

    if (debugMode) {
      console.log(`📍 HP Attacker: ${user.HP}/${user.maxHP}`);
      console.groupEnd();
    }

    return {
      text: `Roubo de vida: ${heal} | HP: ${user.HP}/${user.maxHP}`,
      passiveLogs: [],
    };
  },

  _isImmune(target) {
    return target.hasKeyword?.("imunidade absoluta");
  },

  _buildImmuneResult(baseDamage, user, target) {
    const targetName = formatChampionName(target);
    return {
      baseDamage,
      totalDamage: 0,
      finalHP: target.HP,
      log: `${targetName} está com Imunidade Absoluta!`,
      crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
    };
  },

  resolveDamage(params) {
    const {
      mode = "raw",
      baseDamage,
      directDamage = 0,
      user,
      target,
      skill,
      context,
      options = {},
      allChampions = [],
    } = params;

    if (debugMode) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`🎯 [RESOLVE DAMAGE] ${user.name} → ${target.name}`);
      console.log(`${"=".repeat(80)}`);
    }

    if (this._isImmune(target)) {
      return this._buildImmuneResult(baseDamage, user, target);
    }

    let crit = this.processCrit({
      baseDamage,
      user,
      target,
      context,
      options,
    }) || { didCrit: false, bonus: 0 };

    let damage = this._applyDamageModifiers(
      baseDamage,
      user,
      target,
      skill,
      context,
    );

    // BEFORE HOOKS
    const beforeDeal = this._applyBeforeDealingPassive(
      mode,
      damage,
      crit,
      user,
      target,
      context,
      allChampions,
    );

    damage = beforeDeal.damage;
    crit = beforeDeal.crit;

    const beforeTake = this._applyBeforeTakingPassive(
      mode,
      damage,
      crit,
      user,
      target,
      context,
      allChampions,
    );

    damage = beforeTake.damage;
    crit = beforeTake.crit;

    if (debugMode) console.log("CRIT BEFORE COMPOSE:", crit);

    const finalDamage = this._composeFinalDamage(
      mode,
      damage,
      crit,
      directDamage,
      target,
      context,
    );

    context.extraLogs = [];

    const hpAfter = this._applyDamage(target, finalDamage, context);

    // AFTER HOOKS
    const afterTakeLogs = this._applyAfterTakingPassive(
      user,
      target,
      finalDamage,
      mode,
      crit,
      context,
      allChampions,
    );

    const afterDealLogs = this._applyAfterDealingPassive(
      user,
      target,
      finalDamage,
      mode,
      crit,
      context,
      allChampions,
    );

    // LOG BASE
    let log = this._buildLog(user, target, skill, finalDamage, crit, hpAfter);

    // BEFORE LOGS
    if (beforeDeal.logs?.length) log += "\n" + beforeDeal.logs.join("\n");

    if (beforeTake.logs?.length) log += "\n" + beforeTake.logs.join("\n");

    // AFTER LOGS
    if (afterTakeLogs.length) log += "\n" + afterTakeLogs.join("\n");

    if (afterDealLogs.length) log += "\n" + afterDealLogs.join("\n");

    const ls = this._applyLifeSteal(user, finalDamage, allChampions);

    if (ls) {
      log += "\n" + ls.text;

      if (ls.passiveLogs.length) log += "\n" + ls.passiveLogs.join("\n");
    }

    if (context.extraLogs.length) {
      log += "\n" + context.extraLogs.join("\n");
    }

    if (debugMode) {
      console.group(`🎯 [RESUMO FINAL]`);
      console.log(`Base:`, baseDamage);
      console.log(`After hooks:`, damage);
      console.log(`Final:`, finalDamage);
      console.log(`HP: ${hpAfter}/${target.maxHP}`);
      console.groupEnd();
    }

    return {
      baseDamage,
      totalDamage: finalDamage,
      finalHP: target.HP,
      log,
      crit: {
        chance: user.Critical || 0,
        didCrit: crit.didCrit,
        bonus: crit.bonus,
        roll: crit.roll,
      },
    };
  },
};
