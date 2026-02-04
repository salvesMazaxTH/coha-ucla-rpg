let editMode = false; // Variável para ativar o modo de edição/teste

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

    // ❌ Crítico bloqueado
    if (disable) {
      return {
        didCrit: false,
        bonus: 0,
        roll: null,
        forced: false,
        disabled: true,
      };
    }

    const level = user.Critical || 0;
    const entry = this.critTable[level];

    // Sem nível de crítico
    if (!entry) {
      return {
        didCrit: false,
        bonus: 0,
        roll: null,
        forced: false,
        disabled: false,
      };
    }

    const { bonus, chance } = entry;

    // ✅ Crítico garantido
    if (force) {
      return {
        didCrit: true,
        bonus,
        roll: null,
        forced: true,
        disabled: false,
      };
    }

    /*     const roll = 0.1; // 0.1 para testes */
    const roll = Math.random(); // Descomente para uso normal
    const didCrit = roll < chance;

    if (didCrit) {
      if (user?.passive?.onCriticalHit) {
        /* console.log(`[DamageEngine] Passiva onCritical encontrada! Executando...`); */
        user.passive.onCriticalHit({ user, context });
      } else {
        /*        console.log(`[DamageEngine] Usuário ${user.name} não tem passiva onCritical`) */
      }
    }

    return {
      didCrit,
      bonus: didCrit ? bonus : 0,
      roll,
    };
  },
  // -------------------------------------------------
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
    let crit = {
      level: 0,
      didCrit: false,
      bonus: 0,
      roll: null,
    };

    // 🎲 Só rola crítico se fizer sentido
    if (user?.Critical > 0 || options.force === true) {
      crit = this.rollCrit(user, context, options);
    }

    const critBonus = crit.bonus / 100 || 0;
    let critExtra = baseDamage * critBonus;
    let damage = baseDamage;

    // 🧬 APLICA MODIFICADORES
    if (user?.getDamageModifiers) {
      user.purgeExpiredModifiers(context.currentTurn);
      for (const mod of user.getDamageModifiers()) {
        if (typeof mod.apply === "function") {
          const modified = mod.apply({
            baseDamage: damage,
            user,
            target,
            skill,
          });
          if (typeof modified === "number") {
            damage = modified;
          }
        }
      }
    }

    let finalDamage;
    let passiveLog = null;

    // Passiva ANTES do dano
    if (target.passive?.beforeDamage) {
      const passiveResult = target.passive.beforeDamage({
        attacker: user,
        target,
        damage: finalDamage,
        critExtra,
        damageType: "raw",
        crit,
        context,
      });

      if (passiveResult?.damageReduction) {
        critExtra = Math.max(critExtra - passiveResult.damageReduction, 0);
      }

      if (passiveResult?.reducedCritExtra !== undefined) {
        critExtra = Math.max(passiveResult.reducedCritExtra, 0);
      }

      if (passiveResult?.cancelCrit === true) {
        crit.didCrit = false;
        critExtra = 0;
      }
    }

    // Calcula dano final
    if (editMode) {
      finalDamage = 999;
    } else {
      damage = damage + critExtra;
      finalDamage = this.roundToFive(damage);
      const defense = target.Defense || 0;
      const reduction = target.getTotalDamageReduction?.() || 0;
      finalDamage = Math.max(finalDamage - defense - reduction, 0);
      finalDamage = Math.max(finalDamage, 10);
      finalDamage = this.roundToFive(finalDamage);
    }

    // Aplica o dano
    target.takeDamage(finalDamage);

    // ✅ HP APÓS DANO (antes da passiva curar)
    const hpAfterDamage = target.HP;

    // Passiva DEPOIS do dano (pode curar)
    if (target.passive?.afterDamage && target.HP > 0) {
      const passiveResult = target.passive.afterDamage({
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

    // ✅ HP FINAL (após passiva)
    const finalHP = target.HP;

    // ✅ Monta o log na ordem correta
    let finalLog = `${user.name} usou ${skill} e causou ${finalDamage} de dano a ${target.name}`;

    // Adiciona crítico
    if (crit.didCrit) {
      finalLog += ` (CRÍTICO ${1 + critBonus}x !!!)`;
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
      user.heal(healAmount);
      finalLog += `\n${user.name} roubou ${healAmount} de vida. HP atual: ${user.HP}/${user.maxHP}`;
    }

    return {
      baseDamage,
      crit: {
        level: user.Critical || 0,
        didCrit: crit.didCrit,
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
    let crit = {
      level: 0,
      didCrit: false,
      bonus: 0,
      roll: null,
    };

    // 🎲 Só rola crítico se fizer sentido
    if (
      user?.Critical > 0 ||
      options.force === true ||
      options.disable === true
    ) {
      crit = this.rollCrit(user, context, options);
    }

    const critBonus = crit.bonus / 100 || 0;
    let critExtra = baseDamage * critBonus;
    let damage = baseDamage;

    // 🧬 APLICA MODIFICADORES
    if (user?.getDamageModifiers) {
      user.purgeExpiredModifiers(context.currentTurn);
      for (const mod of user.getDamageModifiers()) {
        if (typeof mod.apply === "function") {
          const modified = mod.apply({
            baseDamage: damage,
            user,
            target,
            skill,
          });
          if (typeof modified === "number") {
            damage = modified;
          }
        }
      }
    }

    let totalDamage = 0;
    let passiveLog = null;

    // Passiva ANTES do dano
    if (target.passive?.beforeDamage) {
      const passiveResult = target.passive.beforeDamage({
        attacker: user,
        target,
        critExtra,
        damage: totalDamage,
        damageType: "hybrid",
        crit,
        context,
      });

      if (passiveResult?.damageReduction) {
        totalDamage = Math.max(totalDamage - passiveResult.damageReduction, 0);
      }

      if (passiveResult?.reducedCritExtra !== undefined) {
        critExtra = Math.max(passiveResult.reducedCritExtra, 0);
      }

      if (passiveResult?.cancelCrit === true) {
        crit.didCrit = false;
        critExtra = 0;
      }
    }

    // Dano inicial cru + bônus de crítico
    damage = baseDamage + critExtra;

    // --- SEPARA PARTES ---
    const direct = Math.min(directDamage, damage);
    const raw = damage - direct;

    // --- FUNIL FINAL ---
    const reduction = target.damageReduction || 0;
    const defense = target.Defense || 0;

    const finalDirect = Math.max(direct - reduction, 0);
    const finalRaw = Math.max(raw - defense - reduction, 0);

    if (editMode) {
      totalDamage = 999;
    } else {
      totalDamage = finalDirect + finalRaw;
      totalDamage = Math.max(totalDamage, 10);
      totalDamage = this.roundToFive(totalDamage);
    }

    // Aplica o dano
    target.takeDamage(totalDamage);

    // ✅ HP APÓS DANO (antes da passiva curar)
    const hpAfterDamage = target.HP;

    // Passiva DEPOIS do dano (pode curar)
    if (target.passive?.afterDamage && target.HP > 0) {
      const passiveResult = target.passive.afterDamage({
        attacker: user,
        target,
        damage: totalDamage,
        damageType: "hybrid",
        context,
      });
      if (passiveResult?.log) {
        passiveLog = passiveResult.log;
      }
    }

    // ✅ HP FINAL (após passiva)
    const finalHP = target.HP;

    // ✅ Monta o log na ordem correta
    let finalLog = `${user.name} usou ${skill} e causou ${totalDamage} de dano a ${target.name}`;

    // Adiciona crítico
    if (crit.didCrit) {
      finalLog += ` (CRÍTICO ${1 + critBonus}x !!!)`;
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
    if (user.LifeSteal > 0 && totalDamage > 0) {
      const healAmount = this.roundToFive((totalDamage * user.LifeSteal) / 100);
      const finalHeal = Math.max(healAmount, 5);
      user.heal(finalHeal);
      finalLog += `\n${user.name} roubou ${finalHeal} de vida. HP atual: ${user.HP}/${user.maxHP}`;
    }

    return {
      baseDamage,
      crit: {
        level: user.Critical || 0,
        didCrit: crit.didCrit,
        bonus: crit.bonus,
        roll: crit.roll,
      },
      directDamage: finalDirect,
      rawDamage: finalRaw,
      totalDamage,
      finalHP,
      log: finalLog,
    };
  },
};
