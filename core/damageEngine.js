const editMode = false;
const debugMode = true; // 🔍 ADICIONAR PARA CONTROLAR LOGS

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
    if (debugMode)
      console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${baseDamage}`);

    let crit = {
      level: user?.Critical || 0,
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };

    if (debugMode) {
      console.log(`👤 Critical Level: ${crit.level}`);
      console.log(
        `🎯 Options: Force=${options.force}, Disable=${options.disable}`,
      );
    }

    if (crit.level > 0 || options.force || options.disable) {
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

    // Adicionar critBonusFactor ao objeto crítico para logs posteriores
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

    const K = 53;

    let adjusted = defense;

    if (defense < 25) {
      adjusted *= 0.6;
    } else if (defense <= 35) {
      adjusted *= 0.725;
    } else if (defense >= 75) {
      adjusted *= 1.35;
    }

    const effective = adjusted / (adjusted + K);

    if (debugMode) {
      console.log(`Defense original: ${defense}`);
      console.log(`Defense ajustada: ${adjusted}`);
      console.log(`K constant: ${K}`);
      console.log(
        `Cálculo: ${adjusted} / (${adjusted} + ${K}) = ${adjusted} / ${adjusted + K}`,
      );
      console.log(`Redução percentual: ${(effective * 100).toFixed(2)}%`);
      console.log(`Dano que PASSA: ${((1 - effective) * 100).toFixed(2)}%`);
      console.groupEnd();
    }

    return effective;
  },

  _composeFinalDamage(mode, damage, crit, direct, target, context) {
    if (debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);
    if (debugMode) {
      console.log(`📍 Damage Base: ${damage}`);
      console.log(`🎯 Mode: ${mode}`);
      console.log(`🛡️ Target Defense: ${target.Defense || 0}`);
      console.log(`💥 Crit Ativo: ${crit.didCrit}`);
      if (crit.didCrit) {
        console.log(`   └─ Crit Extra: ${crit.critExtra}`);
        console.log(`   └─ Crit Bonus Factor: ${crit.critBonusFactor}`);
      }
      console.log(`📦 Direct Damage: ${direct}`);
    }

    // Step 1: Aplicar crítico
    let final = crit.didCrit ? damage + crit.critExtra : damage;
    if (debugMode) {
      if (crit.didCrit) {
        console.log(
          `\n🔥 [CRIT APLICADO] ${damage} + ${crit.critExtra} = ${final}`,
        );
      } else {
        console.log(`\n⚪ [SEM CRÍTICO] Damage: ${final}`);
      }
    }

    if (editMode) {
      if (debugMode) {
        console.log(`🔴 EDIT MODE - Retornando 999`);
        console.groupEnd();
      }
      return 999;
    }

    // Step 2: Defesa
    const defPct = this.defenseToPercent(target.Defense || 0);
    const flat = target.getTotalDamageReduction?.() || 0;

    if (debugMode) {
      console.log(`\n🛡️ [DEFESA]`);
      console.log(`   Defense %: ${(defPct * 100).toFixed(2)}%`);
      console.log(`   Redução Flat: ${flat}`);
    }

    // Step 3: Aplicar defesa conforme modo
    if (mode === "raw") {
      if (debugMode) {
        console.log(`\n📊 [RAW MODE] - Defesa reduz tudo`);
        console.log(`   Damage antes: ${final}`);
        console.log(`   Redução %: -${(final * defPct).toFixed(2)}`);
        console.log(`   Redução flat: -${flat}`);
      }
      final = Math.max(final - final * defPct - flat, 0);
      if (debugMode) console.log(`   Damage após: ${final}`);
    } else {
      if (debugMode)
        console.log(`\n📊 [MIXED MODE] - Direct ignora defesa %, resto sofre`);
      const d = Math.min(direct, final);
      const r = final - d;
      if (debugMode) {
        console.log(`   Direct (sem defesa %): ${d}`);
        console.log(`   Restante (com defesa): ${r}`);
        console.log(`   └─ Redução %: -${(r * defPct).toFixed(2)}`);
        console.log(`   └─ Redução flat: -${flat}`);
      }
      final = Math.max(d - flat, 0) + Math.max(r - r * defPct - flat, 0);
      if (debugMode) console.log(`   Total: ${final}`);
    }

    // Step 4: Mínimo
    final = Math.max(final, 10);
    if (debugMode)
      console.log(`\n📈 [FINALIZAÇÃO] Damage com mínimo (10): ${final}`);

    // Step 5: Arredondar
    final = this.roundToFive(final);
    if (debugMode) {
      console.log(`   Damage arredondado (múltiplo de 5): ${final}`);
      console.groupEnd();
    }

    return final;
  },

  _applyDamage(target, val) {
    if (debugMode) console.group(`❤️ [APLICANDO DANO]`);
    if (debugMode) {
      console.log(`👤 Target: ${target.name}`);
      console.log(`📍 HP Antes: ${target.HP}/${target.maxHP}`);
      console.log(`💥 Dano: ${val}`);
    }

    const hpBefore = target.HP;
    target.takeDamage(val);
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

  _applyBeforeTakingPassive(mode, damage, crit, user, target, context) {
    if (debugMode) {
      console.group(`🛡️ [BEFORE TAKING] Target: ${target.name}`);
      console.log(`Damage inicial: ${damage}`);
      console.log(`Crit ativo: ${crit.didCrit}`);
      if (crit.didCrit) console.log(`CritExtra: ${crit.critExtra}`);
    }

    const hook = target.passive?.beforeTakingDamage;
    if (!hook) {
      if (debugMode) {
        console.log(`Sem passiva beforeTakingDamage`);
        console.groupEnd();
      }
      return { damage, crit };
    }

    const r =
      hook({
        attacker: user,
        target,
        damage,
        crit,
        damageType: mode,
        context,
      }) ?? {};

    if (debugMode) console.log(`Retorno passiva:`, r);

    if (r.cancelCrit) {
      crit.didCrit = false;
      crit.critExtra = 0;
    }

    if (r.reducedCritExtra !== undefined) {
      crit.critExtra = Math.max(r.reducedCritExtra, 0);
    }

    if (r.takeBonusDamage) damage += r.takeBonusDamage;

    if (debugMode) {
      console.log(`Damage final: ${damage}`);
      console.groupEnd();
    }

    return { damage, crit };
  }, // DONE //

  _applyBeforeDealingPassive(mode, damage, crit, user, target, context) {
    const hook = user.passive?.beforeDealingDamage;
    if (!hook) return damage;

    const r =
      hook({
        attacker: user,
        target,
        damage,
        crit,
        damageType: mode,
        context,
      }) ?? {};

    if (r.takeBonusDamage) damage += r.takeBonusDamage;

    return damage;
  }, // DONE //

  _applyAfterTakingPassive(mode, damage, user, target, context) {
    if (debugMode) console.group(`✨ [AFTER TAKING] Target: ${target.name}`);

    const hook = target.passive?.afterTakingDamage;

    if (!hook || target.HP <= 0) {
      if (debugMode) {
        console.log("Passiva inexistente ou target morto");
        console.groupEnd();
      }
      return {};
    }

    if (debugMode) console.log(`Damage recebido: ${damage}`);

    const r =
      hook({
        attacker: user,
        target,
        damage,
        damageType: mode,
        context,
      }) ?? {};

    if (debugMode) {
      console.log(`Retorno passiva:`, r);
      console.groupEnd();
    }

    return r;
  }, // DONE //

  _applyAfterDealingPassive(user, target, damage, mode, crit, context) {
    if (debugMode) console.group(`🔥 [AFTER DEALING] Attacker: ${user.name}`);

    const hook = user.passive?.afterDealingDamage;

    if (!hook || damage <= 0) {
      if (debugMode) {
        console.log(`Hook inexistente ou dano zero`);
        console.groupEnd();
      }
      return {};
    }

    const r =
      hook({
        attacker: user,
        target,
        damage,
        damageType: mode,
        crit,
        context,
      }) ?? {};

    if (debugMode) {
      console.log(`Retorno passiva:`, r);
      console.groupEnd();
    }

    return r;
  }, // DONE //

  _buildLog(user, target, skill, dmg, crit, hpAfter, passiveLog) {
    let log = `${user.name} usou ${skill} e causou ${dmg} de dano a ${target.name}`;

    if (crit.didCrit)
      log += ` (CRÍTICO ${(1 + crit.critBonusFactor).toFixed(2)}x)`;

    log += `\nHP final de ${target.name}: ${hpAfter}/${target.maxHP}`;

    if (passiveLog?.log) {
      if (Array.isArray(passiveLog.log))
        log += "\n" + passiveLog.log.join("\n");
      else log += `\n${passiveLog.log}`;
    }

    return log;
  },

  _applyLifeSteal(user, dmg, log) {
    if (debugMode) console.group(`💉 [LIFESTEAL]`);

    if (user.LifeSteal <= 0 || dmg <= 0) {
      if (debugMode) {
        console.log(`⚠️ Sem lifesteal: LS=${user.LifeSteal}%, DMG=${dmg}`);
        console.groupEnd();
      }
      return;
    }

    if (debugMode) {
      console.log(`👤 Attacker: ${user.name}`);
      console.log(`📊 Damage causado: ${dmg}`);
      console.log(`%.% LifeSteal: ${user.LifeSteal}%`);
    }

    const heal = Math.max(5, this.roundToFive((dmg * user.LifeSteal) / 100));

    if (debugMode) {
      console.log(
        `💚 Cálculo: ${dmg} × ${user.LifeSteal}% = ${((dmg * user.LifeSteal) / 100).toFixed(2)}`,
      );
      console.log(`✅ Heal final (mín. 5, múltiplo de 5): ${heal}`);
    }

    user.heal(heal);

    if (debugMode) {
      console.log(`📍 HP Attacker: ${user.HP}/${user.maxHP}`);
      console.groupEnd();
    }

    log += `\nRoubo de vida: ${heal}`;
  },

  _isImmune(target) {
    return target.hasKeyword?.("imunidade absoluta");
  },

  _buildImmuneResult(baseDamage, user, target) {
    return {
      baseDamage,
      totalDamage: 0,
      finalHP: target.HP,
      log: `${target.name} está com Imunidade Absoluta!`,
      crit: { level: 0, didCrit: false, bonus: 0, roll: null },
    };
  },

  // Calculadora e aplicadora real de dano (Engine principal)
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
    } = params;

    if (debugMode) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`🎯 [RESOLVE DAMAGE] ${user.name} → ${target.name}`);
      console.log(`${"=".repeat(80)}`);
    }

    // ─────────────────────────────
    // 0️⃣ Imunidade
    // ─────────────────────────────
    if (this._isImmune(target)) {
      return this._buildImmuneResult(baseDamage, user, target);
    }

    // ─────────────────────────────
    // 1️⃣ Estado inicial
    // ─────────────────────────────
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

    // ─────────────────────────────
    // 2️⃣ Hooks ofensivos
    // beforeDealingDamage
    // ─────────────────────────────
    damage = this._applyBeforeDealingPassive(
      mode,
      damage,
      crit,
      user,
      target,
      context,
    );

    // ─────────────────────────────
    // 3️⃣ Hooks defensivos
    // beforeTakingDamage
    // ─────────────────────────────
    const beforeTake = this._applyBeforeTakingPassive(
      mode,
      damage,
      crit,
      user,
      target,
      context,
    );

    damage = beforeTake.damage;
    crit.didCrit = beforeTake.didCrit;
    crit.critExtra = beforeTake.critExtra;

    // ─────────────────────────────
    // 4️⃣ Composição final
    // Defesa / Crit / Direct / Caps
    // ─────────────────────────────
    const finalDamage = this._composeFinalDamage(
      mode,
      damage,
      crit,
      directDamage,
      target,
      context,
    );

    // ─────────────────────────────
    // 5️⃣ Aplicação
    // ─────────────────────────────
    const hpAfter = this._applyDamage(target, finalDamage);

    // ─────────────────────────────
    // 6️⃣ Hooks pós-defesa
    // afterTakingDamage
    // ─────────────────────────────
    const afterTakeLog = this._applyAfterTakingPassive(
      mode,
      finalDamage,
      user,
      target,
      context,
    );

    // ─────────────────────────────
    // 7️⃣ Construção do log base
    // ─────────────────────────────
    let log = this._buildLog(
      user,
      target,
      skill,
      finalDamage,
      crit,
      hpAfter,
      afterTakeLog,
    );

    // ─────────────────────────────
    // 8️⃣ Hooks ofensivos finais
    // afterDealingDamage
    // ─────────────────────────────
    const afterDeal = this._applyAfterDealingPassive(
      user,
      target,
      finalDamage,
      mode,
      crit,
      context,
    );

    if (afterDeal?.log) log += `\n${afterDeal.log}`;

    // ─────────────────────────────
    // 9️⃣ Pós-processamento sistêmico
    // ─────────────────────────────
    this._applyLifeSteal(user, finalDamage, log);

    // ─────────────────────────────
    // 🔟 Debug resumo
    // ─────────────────────────────
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
        level: user.Critical || 0,
        didCrit: crit.didCrit,
        bonus: crit.bonus,
        roll: crit.roll,
      },
    };
  },
};
