let editMode = false;
let debugMode = true; // 🔍 ADICIONAR PARA CONTROLAR LOGS

export const DamageEngine = {
  // arredondamentos globais da engine
  roundToFive(x) {
    return Math.round(x / 5) * 5;
  },

  // -------------------------------------------------
  // Crit. related
  // Tabela de crítico
  critTable: {
    1: { bonus: 45, chance: 1 / 6 },
    2: { bonus: 55, chance: 1 / 4 },
    3: { bonus: 65, chance: 2 / 3 },
    4: { bonus: 75, chance: 5 / 6 },
  },

  rollCrit(user, context, options = {}) {
    const { force = false, disable = false } = options;

    const level = user.Critical || 0;
    const entry = this.critTable[level] || { bonus: 0, chance: 0 };

    let { bonus, chance } = entry;

    let didCrit = false;
    let roll = null;

    // 🚫 1. Crítico completamente bloqueado
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

    // ✅ 2. Crítico forçado
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

    // 🎲 3. Roll normal
    roll = Math.random();
    didCrit = roll < chance;

    if (debugMode) {
      console.log(`🎯 Roll: ${roll.toFixed(4)}`);
      console.log(`🎲 Chance necessária: ${(chance * 100).toFixed(2)}%`);
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
    let crit = {
      level: user?.Critical || 0,
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };
    if (crit.level > 0 || options.force || options.disable) {
      crit = this.rollCrit(user, context, options);
    }
    const critBonusFactor = crit.bonus / 100;
    const critExtra = baseDamage * critBonusFactor;

    if (crit.didCrit && user?.passive?.onCriticalHit) {
      if (debugMode) console.log(`🔥 Executando passiva onCriticalHit`);
      user.passive.onCriticalHit({
        user,
        target,
        context,
        forced: crit.forced,
      });
      return { crit, critBonusFactor, critExtra };
    }
  },

  // -------------------------------------------------

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

    const K = defense >= 25 && defense <= 45 ? 61 : 38;
    const effective = defense / (defense + K);

    if (debugMode) {
      console.log(`Defense value: ${defense}`);
      console.log(
        `K constant: ${K} (defense ${defense >= 25 && defense <= 45 ? "between 25-45" : "outside 25-45"})`,
      );
      console.log(
        `Cálculo: ${defense} / (${defense} + ${K}) = ${defense} / ${defense + K}`,
      );
      console.log(`Redução percentual: ${(effective * 100).toFixed(2)}%`);
      console.log(`Dano que PASSA: ${((1 - effective) * 100).toFixed(2)}%`);
      console.groupEnd();
    }

    return effective;
  },

  // ----------------
  // Modificadores
  applyDamageModifiers({ baseDamage, user, target, skill }) {
    if (!user?.getDamageModifiers) return baseDamage;

    user.purgeExpiredModifiers(currentTurn);

    let damage = baseDamage;

    for (const mod of user.getDamageModifiers()) {
      if (typeof mod.apply === "function") {
        damage = mod.apply({
          baseDamage: damage,
          user,
          target,
          skill,
        });
      }
    }

    return damage;
  },

  // -------------------------------------------------
  // Calculadora de dano propriamente dito
  // Dano que sofre defesa
  resolveRaw({ baseDamage, user, target, skill, context, options = {} }) {
    if (debugMode)
      console.group(`⚔️ [RESOLVE RAW] ${user?.name} → ${target?.name}`);

    // Checar por Imunidade Absoluta
    if (target.hasKeyword?.("imunidade absoluta")) {
      if (debugMode) {
        console.log(`🛡️ IMUNIDADE ABSOLUTA DETECTADA`);
        console.groupEnd();
      }
      return {
        baseDamage,
        crit: { level: 0, didCrit: false, bonus: 0, roll: null },
        totalDamage: 0,
        finalHP: target.HP,
        log: `${target.name} está com Imunidade Absoluta! ${user.name} não consegue causar dano.`,
      };
    }

    if (debugMode) console.log(`📊 Base Damage: ${baseDamage}`);

    // 🎲 CRITICAL ROLL
    const crit = this.processCrit({
      baseDamage,
      user,
      target,
      context,
      options,
    });

    const { didCrit, critBonusFactor, critExtra } = crit;

    // Debug
    if (debugMode && didCrit) {
      console.log(`\n💥 CRIT CALCULATION:`);
      console.log(
        `  Bonus: ${crit.bonus}%  Mult: ${(1 + critBonusFactor).toFixed(3)}x`,
      );
      console.log(`  Extra: ${critExtra.toFixed(2)}`);
    }

    let damage = baseDamage;

    // 🧬 APLICA MODIFICADORES
    if (user?.getDamageModifiers) {
      user.purgeExpiredModifiers(context.currentTurn);
      const mods = user.getDamageModifiers();

      if (debugMode && mods.length > 0)
        console.log(`\n🧬 MODIFIERS (${mods.length}):`);

      for (const mod of mods) {
        if (typeof mod.apply === "function") {
          const before = damage;
          const modified = mod.apply({
            baseDamage,
            user,
            target,
            skill,
          });
          if (typeof modified === "number") {
            damage = modified;
            if (debugMode)
              console.log(`  ${mod.name || "Unnamed"}: ${before} → ${damage}`);
          }
        }
      }
    }

    // 🔄 PASSIVE beforeTakingDamage
    let passiveLog = null;
    let adjustedCritExtra = critExtra;

    if (target.passive?.beforeTakingDamage) {
      if (debugMode) console.log(`\n🔄 PASSIVE beforeTakingDamage:`);

      const passiveResult = target.passive.beforeTakingDamage({
        attacker: user,
        target,
        damage,
        critExtra: adjustedCritExtra,
        damageType: "raw",
        crit,
        context,
      });

      if (passiveResult?.damageReduction) {
        adjustedCritExtra = Math.max(
          adjustedCritExtra - passiveResult.damageReduction,
          0,
        );
        if (debugMode)
          console.log(
            `  Redução: -${passiveResult.damageReduction} (critExtra agora: ${adjustedCritExtra})`,
          );
      }

      if (passiveResult?.reducedCritExtra !== undefined) {
        adjustedCritExtra = Math.max(passiveResult.reducedCritExtra, 0);
        if (debugMode)
          console.log(`  CritExtra alterado para: ${adjustedCritExtra}`);
      }

      if (passiveResult?.cancelCrit === true) {
        didCrit = false;
        adjustedCritExtra = 0;
        if (debugMode) console.log(`  ❌ Crítico cancelado`);
      }

      if (passiveResult?.takeBonusDamage) {
        damage += passiveResult.takeBonusDamage;
        if (debugMode)
          console.log(
            `  Dano bônus: +${passiveResult.takeBonusDamage} (damage agora: ${damage})`,
          );
      }
    }

    // 📐 DAMAGE CALCULATION (com crítico incluído)
    let finalDamage = didCrit ? damage + adjustedCritExtra : damage;

    if (debugMode) {
      console.log(`\n📐 DAMAGE CALCULATION:`);
      console.log(`  Base: ${damage.toFixed(2)}`);
      if (didCrit) {
        console.log(`  Crit Extra: ${adjustedCritExtra.toFixed(2)}`);
        console.log(`  Total com crítico: ${finalDamage.toFixed(2)}`);
      }
    }

    // 🛡️ APPLY DEFENSE
    if (!editMode) {
      const defense = target.Defense || 0;
      const defReduction = this.defenseToPercent(defense);
      const extraReduction = target.getTotalDamageReduction?.() || 0;

      if (debugMode) console.log(`\n🛡️ DEFENSE APPLICATION:`);
      if (debugMode) console.log(`  Target Defense: ${defense}`);
      if (debugMode)
        console.log(
          `  Defense Reduction %: ${(defReduction * 100).toFixed(2)}%`,
        );
      if (debugMode) console.log(`  Extra Reduction: ${extraReduction}`);

      finalDamage = Math.max(
        damage - damage * defReduction - extraReduction,
        0,
      );

      if (debugMode) {
        console.log(
          `  Cálculo: ${damage.toFixed(2)} - (${damage.toFixed(2)} * ${(defReduction * 100).toFixed(2)}%) - ${extraReduction}`,
        );
        console.log(`  = ${finalDamage.toFixed(2)}`);
      }

      finalDamage = Math.max(finalDamage, 10);
      if (debugMode && finalDamage < 10)
        console.log(`  ⬆️ Mínimo 10: ${finalDamage}`);

      finalDamage = this.roundToFive(finalDamage);
      if (debugMode) console.log(`  🔢 Arredondado para 5: ${finalDamage}`);
    } else {
      finalDamage = 999;
      if (debugMode) console.log(`  ⚙️ EDIT MODE: finalDamage = 999`);
    }

    // Aplica o dano
    target.takeDamage(finalDamage);
    const hpAfterDamage = target.HP;

    // Passiva DEPOIS do dano (pode curar)
    if (target.passive?.afterTakingDamage && target.HP > 0) {
      const passiveResult = target.passive.afterTakingDamage({
        attacker: user,
        target,
        damage: finalDamage,
        damageType: "raw",
        context,
      });
      if (passiveResult?.log) {
        passiveLog = passiveResult.log;
      }
    }

    const finalHP = target.HP;

    // 📝 LOG CONSTRUCTION
    let finalLog = `${user.name} usou ${skill} e causou ${finalDamage} de dano a ${target.name}`;

    // Adiciona crítico
    if (didCrit) {
      finalLog += ` (CRÍTICO ${(1 + critBonusFactor).toFixed(2)}x !!!)`;
    }

    // ✅ HP após dano (antes da cura)
    finalLog += `.\nHP do alvo após dano: ${hpAfterDamage}/${target.maxHP}`;

    // ✅ Log da passiva (se curou)
    if (passiveLog) {
      finalLog += `\n${passiveLog}`;

      // Se curou, mostra o HP final também
      if (finalHP !== hpAfterDamage) {
        finalLog += `\nHP do alvo após cura: ${finalHP}/${target.maxHP}`;
      }
    }

    // Roubo de vida
    if (user.LifeSteal > 0 && finalDamage > 0) {
      const rawHeal = (finalDamage * user.LifeSteal) / 100;
      const healAmount = Math.max(5, this.roundToFive(rawHeal));
      user.heal(healAmount);
      finalLog += `\n${user.name} roubou ${healAmount} de vida. HP atual: ${user.HP}/${user.maxHP}`;
    }

    // Passiva DO ATACANTE após fazer dano
    if (user.passive?.afterDoingDamage && finalDamage > 0) {
      const passiveResult = user.passive.afterDoingDamage({
        attacker: user,
        target,
        damage: finalDamage,
        damageType: "raw",
        crit,
        context,
      });
      if (passiveResult?.log) {
        finalLog += `\n${passiveResult.log}`;
      }
    }

    if (debugMode) {
      console.log(`\n✅ RESULTADO FINAL:`);
      console.log(`  Total Damage: ${finalDamage}`);
      console.log(`  Target HP: ${finalHP}/${target.maxHP}`);
      console.groupEnd();
    }

    return {
      baseDamage,
      crit: {
        level: user.Critical || 0,
        didCrit: didCrit,
        bonus: crit.bonus,
        roll: crit.roll,
      },
      totalDamage: finalDamage,
      finalHP,
      log: finalLog,
    };
  },

  // Dano híbrido (parte ignora defesa)

  resolveHybrid({
    baseDamage,
    directDamage = 0,
    user,
    target,
    skill,
    context,
    options = {},
  }) {
    if (debugMode)
      console.group(`⚔️ [RESOLVE HYBRID] ${user?.name} → ${target?.name}`);

    if (target.hasKeyword?.("imunidade absoluta")) {
      if (debugMode) {
        console.log(`🛡️ IMUNIDADE ABSOLUTA DETECTADA`);
        console.groupEnd();
      }
      return {
        baseDamage,
        crit: { level: 0, didCrit: false, bonus: 0, roll: null },
        directDamage: 0,
        rawDamage: 0,
        totalDamage: 0,
        finalHP: target.HP,
        log: `${target.name} está com Imunidade Absoluta! ${user.name} não consegue causar dano.`,
      };
    }

    if (debugMode) {
      console.log(`📊 Base Damage: ${baseDamage}`);
      console.log(`💎 Direct Part of Damage: ${directDamage}`);
    }

    // 🎲 CRITICAL ROLL
    const crit = this.processCrit({
      baseDamage: baseDamage - directDamage,
      user,
      target,
      context,
      options,
    });

    const { didCrit, critBonusFactor, critExtra } = crit;

    let damage = baseDamage;

    // 🧬 APLICA MODIFICADORES
    if (user?.getDamageModifiers) {
      user.purgeExpiredModifiers(context.currentTurn);
      const mods = user.getDamageModifiers();

      if (debugMode && mods.length > 0)
        console.log(`\n🧬 MODIFIERS (${mods.length}):`);

      for (const mod of mods) {
        if (typeof mod.apply === "function") {
          const before = damage;
          const modified = mod.apply({
            damage,
            user,
            target,
            skill,
          });
          if (typeof modified === "number") {
            damage = modified;
            if (debugMode)
              console.log(`  ${mod.name || "Unnamed"}: ${before} → ${damage}`);
          }
        }
      }
    }

    // 🔄 PASSIVE beforeTakingDamage
    let passiveLog = null;
    let adjustedCritExtra = critExtra;

    if (target.passive?.beforeTakingDamage) {
      if (debugMode) console.log(`\n🔄 PASSIVE beforeTakingDamage:`);

      const passiveResult = target.passive.beforeTakingDamage({
        attacker: user,
        target,
        damage,
        critExtra: adjustedCritExtra,
        damageType: "hybrid",
        crit,
        context,
      });

      if (passiveResult?.damageReduction) {
        adjustedCritExtra = Math.max(
          adjustedCritExtra - passiveResult.damageReduction,
          0,
        );
        if (debugMode)
          console.log(`  Redução: -${passiveResult.damageReduction}`);
      }

      if (passiveResult?.reducedCritExtra !== undefined) {
        adjustedCritExtra = Math.max(passiveResult.reducedCritExtra, 0);
        if (debugMode)
          console.log(`  CritExtra alterado para: ${adjustedCritExtra}`);
      }

      if (passiveResult?.cancelCrit === true) {
        didCrit = false;
        adjustedCritExtra = 0;
        if (debugMode) console.log(`  ❌ Crítico cancelado`);
      }

      if (passiveResult?.takeBonusDamage) {
        damage += passiveResult.takeBonusDamage;
        if (debugMode)
          console.log(`  Dano bônus: +${passiveResult.takeBonusDamage}`);
      }
    }

    // 📐 DAMAGE CALCULATION (com crítico)
    let finalDamage = didCrit ? damage + adjustedCritExtra : damage;

    if (debugMode) {
      console.log(`\n📐 DAMAGE CALCULATION:`);
      console.log(`  Base: ${damage.toFixed(2)}`);
      if (didCrit) {
        console.log(`  Crit Extra: ${adjustedCritExtra.toFixed(2)}`);
        console.log(`  Total com crítico: ${finalDamage.toFixed(2)}`);
      }
    }

    // --- SEPARA PARTES (direct/raw) ---
    const directPart = Math.min(directDamage, damage);
    const rawPart = damage - directPart;

    if (debugMode) {
      console.log(`\n📐 DAMAGE SEPARATION:`);
      console.log(`  Total damage: ${damage.toFixed(2)}`);
      console.log(`  Direct Capacity: ${directDamage}`);
      console.log(`  Direct Part: ${directPart}`);
      console.log(`  Raw Part: ${rawPart}`);
    }

    // 🛡️ APPLY REDUCTIONS
    const defense = target.Defense || 0;
    const defReduction = this.defenseToPercent(defense);
    const extraReduction = target.getTotalDamageReduction?.() || 0;

    if (debugMode) {
      console.log(`\n🛡️ REDUCTION APPLICATION:`);
      console.log(
        `  Defense: ${defense} (reduz ${(defReduction * 100).toFixed(2)}%)`,
      );
      console.log(`  Flat Reduction: ${extraReduction}`);
    }

    let finalDirectDamage = Math.max(directPart - extraReduction, 0);
    let finalRawDamage = Math.max(
      rawPart - rawPart * defReduction - extraReduction,
      0,
    );

    if (debugMode) {
      console.log(`\n💰 FINAL PARTS:`);
      console.log(
        `  Direct: ${directPart} - ${extraReduction} = ${finalDirectDamage}`,
      );
      console.log(
        `  Raw: ${rawPart} - (${rawPart} * ${(defReduction * 100).toFixed(2)}%) - ${extraReduction} = ${finalRawDamage}`,
      );
    }

    if (!editMode) {
      finalDamage = finalDirectDamage + finalRawDamage;

      if (debugMode)
        console.log(
          `  Total: ${finalDirectDamage} + ${finalRawDamage} = ${finalDamage.toFixed(2)}`,
        );

      finalDamage = Math.max(finalDamage, 10);
      if (debugMode && finalDamage < 10)
        console.log(`  ⬆️ Mínimo 10: ${finalDamage}`);

      finalDamage = this.roundToFive(finalDamage);
      if (debugMode) console.log(`  🔢 Arredondado para 5: ${finalDamage}`);
    } else {
      finalDamage = 999;
      if (debugMode) console.log(`  ⚙️ EDIT MODE: finalDamage = 999`);
    }

    // Aplica o dano
    target.takeDamage(finalDamage);
    const hpAfterDamage = target.HP;

    // Passiva DEPOIS de receber o dano (pode curar)
    if (target.passive?.afterTakingDamage && target.HP > 0) {
      const passiveResult = target.passive.afterTakingDamage({
        attacker: user,
        target,
        damage: finalDamage,
        damageType: "hybrid",
        context,
      });
      if (passiveResult?.log) {
        passiveLog = passiveResult.log;
      }
    }

    const finalHP = target.HP;

    // 📝 LOG CONSTRUCTION
    let finalLog = `${user.name} usou ${skill} e causou ${finalDamage} de dano a ${target.name}`;

    // Adiciona crítico
    if (didCrit) {
      finalLog += ` (CRÍTICO ${(1 + crit.bonus).toFixed(2)}x !!!)`;
    }

    // ✅ HP após dano (antes da cura)
    finalLog += `.\nHP do alvo após dano: ${hpAfterDamage}/${target.maxHP}`;

    // ✅ Log da passiva (se curou)
    if (passiveLog) {
      finalLog += `\n${passiveLog}`;

      // Se curou, mostra o HP final também
      if (finalHP !== hpAfterDamage) {
        finalLog += `\nHP do alvo após cura: ${finalHP}/${target.maxHP}`;
      }
    }

    // Roubo de vida
    if (user.LifeSteal > 0 && finalDamage > 0) {
      const healAmount = this.roundToFive((finalDamage * user.LifeSteal) / 100);
      const finalHeal = Math.max(healAmount, 5);
      user.heal(finalHeal);
      finalLog += `\n${user.name} roubou ${finalHeal} de vida. HP atual: ${user.HP}/${user.maxHP}`;
    }

    // Passiva DO ATACANTE após fazer dano
    if (user.passive?.afterDoingDamage && finalDamage > 0) {
      const passiveResult = user.passive.afterDoingDamage({
        attacker: user,
        target,
        damage: finalDamage,
        damageType: "hybrid",
        crit,
        context,
      });
      if (passiveResult?.log) {
        finalLog += `\n${passiveResult.log}`;
      }
    }

    if (debugMode) {
      console.log(`\n✅ RESULTADO FINAL:`);
      console.log(`  Direct Damage: ${finalDirectDamage}`);
      console.log(`  Raw Damage: ${finalRawDamage}`);
      console.log(`  Total Damage: ${finalDamage}`);
      console.log(`  Target HP: ${finalHP}/${target.maxHP}`);
      console.groupEnd();
    }

    return {
      baseDamage,
      crit: {
        level: user.Critical || 0,
        didCrit,
        bonus: crit.bonus,
        roll: crit.roll,
      },
      directDamage: finalDirectDamage,
      rawDamage: finalRawDamage,
      totalDamage: finalDamage,
      finalHP,
      log: finalLog,
    };
  },
};
