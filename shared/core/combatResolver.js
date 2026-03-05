/* import { formatChampionName } from "./formatters.js";
import { emitCombatEvent } from "./combatEvents.js";

const debugMode = false;

const DEFAULT_CRIT_BONUS = 55;
const MAX_CRIT_CHANCE = 95;

const ELEMENT_CYCLE = ["fire", "ice", "earth", "lightning", "water"];
 */

import { DamageEvent } from "./DamageEvent.js";

export const CombatResolver = {
  // ==========================================================
  // UTILITÁRIOS BÁSICOS
  // ==========================================================
  /* roundToFive(x) {
    return Math.round(x / 5) * 5;
  }, */

  // ==========================================================
  // FLUXO PRINCIPAL (ORQUESTRADOR)
  // ==========================================================

  processDamageEvent(params) {
    const {
      baseDamage,
      user,
      target,
      skill,
      context = {},
      allChampions,
    } = params;
    console.log("ALL-CHAMPIONS DEBUG processDamageEvent chamado com params:", params, "allChampions:", allChampions);
    const event = new DamageEvent(params);

    // 2. Dispara a pipeline que montamos
    // O retorno aqui será o objeto (ou array) vindo do buildFinalResult()
    return event.execute();

    /// ANTIGO processDamageEvent:
    /*  const ctx = this._normalizeContext(params);

    console.log(
      "🔥 processDamageEvent chamado. Fila extraDamageQueue atual:",
      ctx.context.extraDamageQueue,
    );

    const early = this._handlePreChecks(ctx);

    if (early) {
      ctx.context.registerDamage({
        target: ctx.target,
        amount: 0,
        sourceId: ctx.user?.id,
        flags: {
          evaded: true,
          immune: early.immune === true,
          shieldBlocked: early.shieldBlocked === true,
        },
      });
      return {
        totalDamage: 0,
        ...early,
        targetId: ctx.target.id,
        userId: ctx.user?.id,
      };
    }

    this._runBeforeHooks(ctx);

    ctx.finalDamage = this._composeFinalDamage(
      ctx.mode,
      ctx.damage,
      ctx.crit,
      ctx.piercingPortion,
      ctx.target,
      ctx.context,
    );

    const applied = this._applyDamage(ctx.target, ctx.finalDamage, ctx.context);

    ctx.hpAfter = applied.hpAfter;
    ctx.actualDmg = applied.actualDmg;

    ctx.context.registerDamage({
      target: ctx.target,
      amount: ctx.finalDamage,
      sourceId: ctx.user?.id,
      isCritical: ctx.crit?.didCrit,
      flags: {
        evaded: ctx.evasionAttempt ? false : undefined,
      },
    });

    const hasExecution = typeof ctx.skill?.executeRule === "function";
    console.log("🔥 hasExecution:", hasExecution);
    if (hasExecution) {
      this._processExecuteIfNeeded(ctx);
    }

    const lifesteal = this._applyLifeSteal(
      ctx.user,
      applied.actualDmg,
      ctx.allChampions,
    );
    ctx.lifesteal = lifesteal;

    this._runAfterHooks(ctx);

    const extraResults = this._processExtraQueue(ctx);

    return this._buildFinalResult(ctx, extraResults); */
  },

  // ==========================================================
  // PRÉ-CHECAGENS
  // ==========================================================

  /* _rollEvasion({ attacker, target, context }) {
    const editMode = context?.editMode ?? {};
    const chance = Number(target.Evasion) || 0;

    if (debugMode) {
      console.log("🔥 _rollEvasion chamado:", {
        attacker: attacker.name,
        target: target.name,
        evasion: chance,
        editMode,
      });
    }

    // 1️⃣ Override absoluto (debug)
    if (editMode.alwaysEvade) {
      return {
        attempted: true,
        evaded: true,
        log: `\n${formatChampionName(target)} evadiu automaticamente.`,
      };
    }

    // 2️⃣ Sem chance real
    if (chance <= 0 && !editMode.alwaysEvade) {
      return null; // NÃO houve tentativa
    }

    // 3️⃣ Roll
    const roll = Math.random() * 100;
    const evaded = roll < chance;

    if (debugMode) {
      console.log(`🎯 Roll de Esquiva: ${roll.toFixed(2)}`);
      console.log(`🎲 Chance de Esquiva: ${chance}%`);
      console.log(evaded ? "✅ Ataque EVADIDO!" : "❌ Ataque ACERTADO");
    }

    // 4️⃣ Resultado padronizado
    return {
      evaded,
      attempted: true,
      log: `\n${formatChampionName(target)} tentou esquivar o ataque... !`,
    };
  }, */

  // ==========================================================
  // CRÍTICO
  // ==========================================================

  /*  rollCrit(user, context, critOptions = {}) {
    const { force = false, disable = false } = critOptions;

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

    roll = Math.random() * 100;
    didCrit = context?.editMode?.alwaysCrit ? true : roll < chance;

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

  processCrit({ baseDamage, user, target, context, critOptions = {} }) {
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
        `🎯 critOptions: Force=${critOptions.force}, Disable=${critOptions.disable}`,
      );
    }

    if (crit.chance > 0 || critOptions.force || critOptions.disable) {
      crit = this.rollCrit(user, context, critOptions);
      if (debugMode) console.log(`🎲 Roll Result:`, crit);
    }

    const critBonusFactor = crit.bonus / 100;
    const critExtra = baseDamage * critBonusFactor;

    if (debugMode) {
      console.log(`📊 Crit Bonus Factor: ${critBonusFactor} (${crit.bonus}%)`);
      console.log(`💥 Extra Damage from Crit: ${critExtra}`);
      console.log(`✅ Did Crit: ${crit.didCrit}`);
    }

    if (crit.didCrit) {
      if (debugMode) console.log(`🔥 Executando passiva onCriticalHit`);
      emitCombatEvent(
        "onCriticalHit",
        {
          attacker: user,
          critSrc: user,
          target,
          context,
          forced: crit.forced,
        },
        context?.allChampions || context?.aliveChampions,
      );
    }

    crit.critBonusFactor = critBonusFactor;
    crit.critExtra = critExtra;

    if (debugMode) console.groupEnd();

    return crit;
  }, */

  // ==========================================================
  // CÁLCULO E APLICAÇÃO DE DANO
  // ==========================================================

  /* _applyDamageModifiers(damage, user, target, skill, context) {
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
        const out = mod.apply({
          baseDamage: damage,
          user,
          target,
          skill,
        });
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
  }, */

  // ================================

  /*   defenseToPercent(defense) {
    if (debugMode) console.group(`🛡️ [DEFENSE DEBUG]`);

    if (!defense) {
      if (debugMode) {
        console.log(`Defense: ${defense} (ou 0)`);
        console.log(`Redução percentual: 0%`);
        console.groupEnd();
      }
      return 0;
    }

    // --- Constantes globais do modelo ---
    const BASE_DEF = 220;
    const BASE_REDUCTION = 0.75;
    const MAX_REDUCTION = 0.95;
    const K = 0.0045;

    // --- Curva base (até 150) ---
    const curve = {
      0: 0.0,
      35: 0.25,
      60: 0.4,
      85: 0.53,
      110: 0.6,
      150: 0.65,
      200: 0.72,
      220: 0.78,
    };

    const keys = Object.keys(curve)
      .map(Number)
      .sort((a, b) => a - b);

    let effective = 0;

    // ================================
    // Segmento 1 — interpolado
    // ================================
    if (defense <= BASE_DEF) {
      if (defense <= keys[0]) {
        effective = curve[keys[0]];
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
    }
    // ================================
    // Segmento 2 — cauda assintótica
    // ================================
    else {
      effective =
        BASE_REDUCTION +
        (MAX_REDUCTION - BASE_REDUCTION) *
          (1 - Math.exp(-K * (defense - BASE_DEF)));
    }

    // Segurança numérica
    effective = Math.min(effective, MAX_REDUCTION);

    if (debugMode) {
      console.log(`Defense original: ${defense}`);
      console.log(`Redução interpolada: ${(effective * 100).toFixed(2)}%`);
      console.log(`Dano que PASSA: ${((1 - effective) * 100).toFixed(2)}%`);
      console.groupEnd();
    }

    return effective;
  }, */

  // ------------------

  /* _getAffinityDamage(damage, skillElement, target, context) {
    console.log("🔥 _getAffinityDamage chamado:", {
      skillElement,
      target: target.name,
      affinities: target.elementalAffinities,
      damage,
    });

    if (!skillElement) return damage;
    if (!target?.elementalAffinities?.length) return damage;

    let finalDamage = damage;
    let strongestRelation = "neutral";

    for (const affinity of target.elementalAffinities) {
      const relation = this._getElementalRelation(skillElement, affinity);

      if (relation === "weak") {
        finalDamage = Math.floor(damage * 1.2 + 25);
        strongestRelation = "weak";
        break;
      }

      if (relation === "resist" && strongestRelation !== "weak") {
        finalDamage = Math.max(damage - 40, 0);
        strongestRelation = "resist";
        break;
      }
    }

    if (strongestRelation !== "neutral") {
      const message =
        strongestRelation === "weak"
          ? "✨ É SUPER-EFETIVO!"
          : strongestRelation === "resist"
            ? "🛡️ Não é muito efetivo..."
            : null;
      if (message) {
        context.dialogEvents = context.dialogEvents || [];
        context.dialogEvents.push({
          type: "dialog",
          message,
          blocking: false,
        });
      }
    }

    context.ignoreMinimumFloor = true;
    return finalDamage;
  },

  _getElementalRelation(attackingElement, defendingElement) {
    const index = ELEMENT_CYCLE.indexOf(attackingElement);

    if (index === -1) return "neutral";

    const strongAgainst = ELEMENT_CYCLE[(index + 1) % ELEMENT_CYCLE.length];
    const weakAgainst =
      ELEMENT_CYCLE[(index - 1 + ELEMENT_CYCLE.length) % ELEMENT_CYCLE.length];

    if (defendingElement === strongAgainst) return "weak";

    if (defendingElement === weakAgainst) return "resist";

    return "neutral";
  },

  _composeFinalDamage(
    mode,
    damage,
    crit,
    piercingPortion = 0,
    target,
    context,
  ) {
    if (debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);

    crit ??= { didCrit: false, critExtra: 0 };

    let finalDamage = damage;

    const damageOverride = context?.editMode?.damageOutput;
    if (damageOverride != null) {
      if (debugMode) console.groupEnd();
      return damageOverride;
    }

    // ---------------- ABSOLUTE ----------------
    if (mode === "absolute") {
      finalDamage = damage;

      if (debugMode) {
        console.log("⚡ ABSOLUTE DAMAGE");
        console.log("➡️ ignora crítico, defesa e reduções");
        console.log(`📈 Final: ${finalDamage}`);
        console.groupEnd();
      }

      return finalDamage;
    }

    // aplica crítico
    if (crit.didCrit) {
      finalDamage += crit.critExtra;
    }

    const baseDefense = target.baseDefense ?? target.Defense;
    const currentDefense = target.Defense;

    const defenseUsed = crit.didCrit
      ? Math.min(baseDefense, currentDefense)
      : currentDefense;

    const defensePercent = this.defenseToPercent(defenseUsed);
    const flatReduction = target.getTotalDamageReduction?.() || 0;

    // ---------------- STANDARD ----------------
    if (mode === "standard" || piercingPortion <= 0) {
      finalDamage = finalDamage - finalDamage * defensePercent - flatReduction;
    }

    // ---------------- PIERCING/PIERCING HYBRID ----------------
    else if (piercingPortion > 0) {
      const piercing = Math.min(piercingPortion, finalDamage);
      const standard = finalDamage - piercing;

      let standardAfter = standard - standard * defensePercent - flatReduction;

      let piercingAfter = piercing - flatReduction;

      standardAfter = Math.max(standardAfter, 0);
      piercingAfter = Math.max(piercingAfter, 0);

      finalDamage = standardAfter + piercingAfter;
    }

    // -------- FLOOR (piso mínimo)-------- 
    if (!context?.ignoreMinimumFloor) {
      finalDamage = Math.max(finalDamage, 10);
    }

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

    val = context.ignoreMinimumFloor ? Math.max(val, 0) : Math.max(val, 10);

    val = this.roundToFive(val);

    target.takeDamage(val, context);

    console.log(
      `➡️ [applyDamage] Dano aplicado, após takeDamage: ${val}, HP de ${target.name}: ${target.HP}/${target.maxHP}`,
    );

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

    return { hpAfter, actualDmg };
  },

  _processExecuteIfNeeded(ctx) {
    console.log("🔥 _processExecuteIfNeeded chamado:", {
      target: ctx.target.name,
      hp: ctx.target.HP,
      maxHP: ctx.target.maxHP,
    });
    const rule = ctx.skill?.executeRule;
    if (!rule) return;

    if (ctx.target.alive === false) return;

    if (ctx.target.team === ctx.user.team) return;

    let threshold = rule(ctx);

    const override = ctx.context?.editMode?.executionOverride;

    if (typeof override === "number") {
      threshold = override;
    }

    const hpPercent = ctx.target.HP / ctx.target.maxHP;

    if (hpPercent <= threshold && ctx.target.HP > 0) {
      ctx.target.HP = 0;
      ctx.target.alive = false;

      ctx.context.registerDamage({
        target: ctx.target,
        amount: 999,
        sourceId: ctx.user?.id,
        flags: { isExecute: true },
      });
    }
  },

  _applyBeforeDealingPassive({
    mode,
    skill,
    damage,
    crit,
    attacker,
    target,
    context,
    allChampions,
  }) {
    const results = emitCombatEvent(
      "onBeforeDmgDealing",
      {
        mode,
        damage,
        crit,
        skill,
        attacker, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        target, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        dmgSrc: attacker,
        dmgReceiver: target,
        context,
      },
      allChampions,
    );

    const logs = [];
    const effects = [];

    for (const r of results) {
      if (!r) continue;

      // Caso antigo: hook retornava array direto
      if (Array.isArray(r)) {
        logs.push(...r);
        continue;
      }

      // Override de dano
      if (r.damage !== undefined) {
        damage = r.damage;
      }

      // Override de crit
      if (r.crit !== undefined) {
        crit = r.crit;
      }

      // Logs (aceita log OU logs)
      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }

      if (r.logs) {
        if (Array.isArray(r.logs)) logs.push(...r.logs);
        else logs.push(r.logs);
      }

      // 🔥 Effects
      if (r.effects?.length) {
        effects.push(...r.effects);
      }
    }

    return {
      damage,
      crit,
      logs,
      effects,
    };
  },

  _applyBeforeTakingPassive({
    mode,
    damage,
    crit,
    skill,
    attacker,
    target,
    context,
    allChampions,
  }) {
    const results = emitCombatEvent(
      "onBeforeDmgTaking",
      {
        mode,
        damage,
        crit,
        skill,
        attacker, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        target, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        dmgSrc: attacker,
        dmgReceiver: target,
        context,
      },
      allChampions,
    );

    const effects = [];
    const logs = [];

    for (const r of results) {
      if (!r) continue;

      // Caso antigo: hook retornava array direto
      if (Array.isArray(r)) {
        logs.push(...r);
        continue;
      }

      // Override de dano
      if (r.damage !== undefined) {
        damage = r.damage;
      }

      // Override de crit
      if (r.crit !== undefined) {
        crit = r.crit;
      }

      // Logs (aceita log OU logs)
      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }

      if (r.logs) {
        if (Array.isArray(r.logs)) logs.push(...r.logs);
        else logs.push(r.logs);
      }

      // 🔥 Effects
      if (r.effects?.length) {
        effects.push(...r.effects);
      }
    }

    return {
      damage,
      crit,
      logs,
      effects,
    };
  },

  _applyAfterTakingPassive({
    attacker,
    target,
    skill,
    damage,
    mode,
    crit,
    context,
    allChampions,
  }) {
    console.log("🔥 _applyAfterTakingPassive ENTER");
    console.log({
      attacker: attacker?.name, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
      target: target?.name, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
      dmgSrc: attacker?.name,
      dmgReceiver: target?.name,
      skill,
      damage,
      mode,
      crit,
    });

    const results = emitCombatEvent(
      "onAfterDmgTaking",
      {
        attacker, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        target, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        dmgSrc: attacker,
        dmgReceiver: target,
        skill,
        damage,
        mode,
        crit,
        context,
      },
      allChampions,
    );

    const effects = [];
    const logs = [];

    for (const r of results) {
      if (!r) continue;

      // Caso antigo: hook retornava array direto
      if (Array.isArray(r)) {
        logs.push(...r);
        continue;
      }

      // Override de dano
      if (r.damage !== undefined) {
        damage = r.damage;
      }

      // Override de crit
      if (r.crit !== undefined) {
        crit = r.crit;
      }

      // Logs (aceita log OU logs)
      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }

      if (r.logs) {
        if (Array.isArray(r.logs)) logs.push(...r.logs);
        else logs.push(r.logs);
      }

      // 🔥 Effects
      if (r.effects?.length) {
        effects.push(...r.effects);
      }
    }

    return {
      damage,
      crit,
      logs,
      effects,
    };
  },

  _applyAfterDealingPassive({
    attacker,
    target,
    damage,
    mode,
    crit,
    skill,
    context,
    allChampions,
  }) {
    if (context?.isDot) return [];

    const results = emitCombatEvent(
      "onAfterDmgDealing",
      {
        attacker, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        target, // aliase enquanto refatora e migra tudo para consistência com os outros hooks
        dmgSrc: attacker,
        dmgReceiver: target,
        damage,
        mode,
        crit,
        skill,
        context,
      },
      allChampions,
    );

    const effects = [];
    const logs = [];

    for (const r of results) {
      if (!r) continue;

      // Caso antigo: hook retornava array direto
      if (Array.isArray(r)) {
        logs.push(...r);
        continue;
      }

      // Override de dano
      if (r.damage !== undefined) {
        damage = r.damage;
      }

      // Override de crit
      if (r.crit !== undefined) {
        crit = r.crit;
      }

      // Logs (aceita log OU logs)
      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }

      if (r.logs) {
        if (Array.isArray(r.logs)) logs.push(...r.logs);
        else logs.push(r.logs);
      }

      // 🔥 Effects
      if (r.effects?.length) {
        effects.push(...r.effects);
      }
    }

    return {
      damage,
      crit,
      logs,
      effects,
    };
  },
 */
  // ==========================================================
  // LOG E RECUPERAÇÃO
  // ==========================================================
  /* 
  _buildLog(user, target, skill, dmg, crit, hpAfter) {
    const userName = formatChampionName(user);
    const targetName = formatChampionName(target);

    // skill pode ser objeto ou string
    const skillName = skill && typeof skill === "object" ? skill.name : skill;
    let log = `${userName} usou ${skillName} e causou ${dmg} de dano a ${targetName}`;

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
      return { amount: 0, text: null, passiveLogs: [] };
    }

    const heal = Math.max(5, this.roundToFive((dmg * user.LifeSteal) / 100));

    if (debugMode) {
      console.log(`👤 Attacker: ${user.name}`);
      console.log(`📊 Damage causado: ${dmg}`);
      console.log(`💚 Heal final: ${heal}`);
    }

    const hpBefore = user.HP;

    const effectiveHeal = Math.min(heal, user.maxHP - hpBefore);

    if (effectiveHeal <= 0) {
      return { amount: 0, text: null, passiveLogs: [] };
    }

    user.heal(effectiveHeal, { suppressHealEvents: true });

    // ================================
    // 🔥 EVENT PIPELINE (CORRIGIDO)
    // ================================

    const results = emitCombatEvent(
      "onAfterLifeSteal",
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
      amount: effectiveHeal,
      text: `Roubo de vida: ${effectiveHeal} | HP: ${user.HP}/${user.maxHP}`,
      passiveLogs,
    };
  },

  // ==========================================================
  // RESULTADOS DE BLOQUEIO/IMUNIDADE
  // ==========================================================

  _isImmune(target) {
    return target.hasKeyword?.("imunidade absoluta");
  },

  _buildImmuneResult(baseDamage, user, target, skill) {
    const targetName = formatChampionName(target);
    const username = formatChampionName(user);
    return {
      baseDamage,
      totalDamage: 0,
      finalHP: target.HP,
      targetId: target.id,
      userId: user.id,
      evaded: false,
      log: `${username} tentou usar ${skill && typeof skill === "object" ? skill.name : skill} em ${targetName}, mas ${targetName} está com Imunidade Absoluta!`,
      crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
    };
  },

  _buildShieldBlockResult(baseDamage, user, target, skill) {
    const targetName = formatChampionName(target);
    const username = formatChampionName(user);
    return {
      baseDamage,
      totalDamage: 0,
      finalHP: target.HP,
      targetId: target.id,
      userId: user.id,
      evaded: false,
      log: `${username} usou ${skill && typeof skill === "object" ? skill.name : skill} em ${targetName}, mas o escudo de ${targetName} bloqueou completamente e se dissipou!`,
      crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
    };
  },

  // ==========================================================
  // FLUXO PRINCIPAL - CONTEXTO
  // ==========================================================

  _normalizeContext(params) {
    const {
      mode = "standard",
      baseDamage = 0,
      piercingPortion = 0,
      user,
      target,
      skill,
      context = {},
      critOptions = {},
      allChampions = [],
    } = params;

    const damageDepth = context.damageDepth ?? 0;

    //console.log("[_normalizeContext] target: ", target);

    if (damageDepth === 0) {
      console.group(`⚔️ ${user.name} → ${target.name}`);
    } else {
      console.group(`↪️ REAÇÃO (${context.origin || "extra"})`);
    }

    return {
      mode,
      baseDamage: Number.isFinite(baseDamage) ? baseDamage : 0,
      damage: Number.isFinite(baseDamage) ? baseDamage : 0,
      piercingPortion,
      user,
      target,
      skill,
      critOptions,
      allChampions,
      crit: { didCrit: false },
      beforeLogs: [],
      afterLogs: [],
      context: {
        ...context,
        damageDepth,
        extraDamageQueue: context.extraDamageQueue ?? [],
        extraLogs: context.extraLogs ?? [],
        extraEffects: context.extraEffects ?? [],
      },
    };
  }, */

  // ==========================================================
  // FLUXO PRINCIPAL - ETAPA 1: PRE CHECKS
  // ==========================================================

  /*   _handlePreChecks(ctx) {
    const { mode, user, target, baseDamage, skill, context } = ctx;

    // IMUNE SEMPRE
    if (this._isImmune(target)) {
      console.groupEnd();
      return this._buildImmuneResult(baseDamage, user, target, skill);
    }

    // 2️⃣ HIT CHECK (evasão) absolute ignora esquiva, e skills com "cannotBeEvaded" também
    if (mode !== "absolute" && !ctx.skill?.cannotBeEvaded) {
      const evasion = this._rollEvasion({ attacker: user, target, context });

      if (evasion?.evaded) {
        context.registerDamage({
          target,
          amount: 0,
          sourceId: user?.id,
          flags: { evaded: true },
        });

        return {
          totalDamage: 0,
          evaded: true,
          targetId: target.id,
          userId: user.id,
        };
      }
    }

    // 3️⃣ SHIELD (ABSOLUTE ignora escudo, e skills com "cannotBeBlocked" também)
    if (mode !== "absolute" && !ctx.skill?.cannotBeBlocked) {
      if (target._checkAndConsumeShieldBlock?.(context)) {
        context.registerDamage({
          target,
          amount: 0,
          sourceId: user?.id,
          flags: { shieldBlocked: true },
        });

        return this._buildShieldBlockResult(baseDamage, user, target, skill);
      }
    }

    return null;
  },
  // ==========================================================
  // FLUXO PRINCIPAL - ETAPA 2: BEFORE HOOKS
  // ==========================================================

  _runBeforeHooks(ctx) {
    const { mode, user, target, skill, context, allChampions } = ctx;

    if (mode !== "absolute") {
      ctx.crit = this.processCrit({
        baseDamage: ctx.damage,
        user,
        target,
        context,
        critOptions: ctx.critOptions,
      }) ?? { didCrit: false };

      ctx.damage = this._applyDamageModifiers(
        ctx.damage,
        user,
        target,
        skill,
        context,
      );

      const beforeDeal = this._applyBeforeDealingPassive({
        mode,
        skill,
        damage: ctx.damage,
        crit: ctx.crit,
        attacker: user,
        target,
        context,
        allChampions,
      });

      if (beforeDeal?.damage !== undefined) ctx.damage = beforeDeal.damage;
      if (beforeDeal?.crit !== undefined) ctx.crit = beforeDeal.crit;
      if (beforeDeal?.logs?.length) ctx.beforeLogs.push(...beforeDeal.logs);

      const beforeTake = this._applyBeforeTakingPassive({
        mode,
        skill,
        damage: ctx.damage,
        crit: ctx.crit,
        dmgSrc: user,
        dmgReceiver: target,
        context,
        allChampions,
      });

      if (beforeTake?.damage !== undefined) ctx.damage = beforeTake.damage;
      if (beforeTake?.crit !== undefined) ctx.crit = beforeTake.crit;
      if (beforeTake?.logs?.length) ctx.beforeLogs.push(...beforeTake.logs);
    }
  },

  // ==========================================================
  // FLUXO PRINCIPAL - ETAPA 3: AFTER HOOKS
  // ==========================================================

  _runAfterHooks(ctx) {
    const { user, target, skill, actualDmg, context, allChampions } = ctx;

    const afterTake = this._applyAfterTakingPassive({
      attacker: user,
      target,
      skill,
      damage: actualDmg,
      context,
      allChampions,
    });

    const afterDeal = this._applyAfterDealingPassive({
      attacker: user,
      target,
      skill,
      damage: actualDmg,
      context,
      allChampions,
    });

    if (afterTake?.logs?.length) ctx.afterLogs.push(...afterTake.logs);

    if (afterDeal?.logs?.length) ctx.afterLogs.push(...afterDeal.logs);
  },

  // ==========================================================
  // FLUXO PRINCIPAL - ETAPA 4: EXTRA QUEUE
  // ==========================================================

  _processExtraQueue(ctx) {
    console.log(
      "🔥 _processExtraQueue chamado. Itens na fila:",
      ctx.context.extraDamageQueue.length,
      "objetos extraDamageQueue:",
      ctx.context.extraDamageQueue,
    );

    const { context, allChampions } = ctx;
    if (!context.extraDamageQueue.length) return [];

    const queue = [...context.extraDamageQueue];
    context.extraDamageQueue = [];

    const results = [];

    for (const extra of queue) {
      console.log("EXTRA ITEM:", extra);
      const result = this.processDamageEvent({
        ...extra,
        context: {
          ...context,
          damageDepth: (context.damageDepth ?? 0) + 1,
          origin: extra.skill?.key || "reaction",
        },
        allChampions,
      });

      if (Array.isArray(result)) results.push(...result);
      else if (result) results.push(result);
    }

    return results;
  },

  // ==========================================================
  // FLUXO PRINCIPAL - ETAPA 5: FINAL RESULT
  // ==========================================================

  _buildFinalResult(ctx, extraResults) {
    const {
      user,
      target,
      skill,
      actualDmg,
      hpAfter,
      crit,
      beforeLogs,
      afterLogs,
      context,
    } = ctx;

    let log = this._buildLog(user, target, skill, actualDmg, crit, hpAfter);

    const allLogs = [...beforeLogs, ...afterLogs, ...(context.extraLogs || [])];

    if (allLogs.length) {
      log += "\n" + allLogs.join("\n");
    }

    console.groupEnd();

    const main = {
      totalDamage: actualDmg,
      finalHP: target.HP,
      targetId: target.id,
      userId: user.id,
      log,
      crit,
      damageDepth: context.damageDepth,
      skill,
    };

    if (extraResults.length) {
      return [main, ...extraResults];
    }

    return main;
  },
  */
};
