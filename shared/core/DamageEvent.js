class DamageEvent {
  static Modes = {
    STANDARD: "standard",
    HYBRID: "hybrid",
    ABSOLUTE: "absolute",
  };

  constructor(params) {
    this.mode = params.mode ?? DamageEvent.Modes.STANDARD;

    this.baseDamage = Number(params.baseDamage) || 0;
    this.damage = this.baseDamage;

    this.piercingPortion = params.piercingPortion || 0;

    this.user = params.user;
    this.target = params.target;
    this.skill = params.skill;

    this.context = params.context ?? {};
    this.allChampions = params.allChampions ?? [];
    this.critOptions = params.critOptions ?? {};

    this.damageDepth = this.context.damageDepth ?? 0;

    // 🔥 ESTADO INTERNO
    this.crit = { didCrit: false };
    this.finalDamage = 0;
    this.actualDmg = 0;
    this.hpAfter = null;

    this.beforeLogs = [];
    this.afterLogs = [];
    this.extraResults = [];
    this.lifesteal = null;

    this.context.extraDamageQueue ??= [];
    this.context.extraLogs ??= [];
    this.context.extraEffects ??= [];
  }

  execute() {
    if (this._preChecks()) {
      return this._buildEarlyResult();
    }

    this._prepareDamage();
    this._runBeforeHooks();
    this._composeFinalDamage();
    this._applyDamage();
    this._processExecuteIfNeeded();
    this._runAfterHooks();
    this._processExtraQueue();

    return this._buildFinalResult();
  }

  _defenseToPercent(defense) {
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
  }

  _preChecks() {
    // 1️⃣ IMUNIDADE
    if (this._isImmune()) {
      console.groupEnd();
      return this._buildImmuneResult();
    }

    // 2️⃣ EVASÃO
    if (
      this.mode !== DamageEvent.Modes.ABSOLUTE &&
      !this.skill?.cannotBeEvaded
    ) {
      const evasion = this._rollEvasion({
        attacker: this.user,
        target: this.target,
        context: this.context,
      });

      if (evasion?.evaded) {
        this.context.registerDamage({
          target: this.target,
          amount: 0,
          sourceId: this.user?.id,
          flags: { evaded: true },
        });

        return {
          totalDamage: 0,
          evaded: true,
          targetId: this.target.id,
          userId: this.user.id,
        };
      }
    }

    // 3️⃣ SHIELD
    if (
      this.mode !== DamageEvent.Modes.ABSOLUTE &&
      !this.skill?.cannotBeBlocked
    ) {
      if (this.target._checkAndConsumeShieldBlock?.(this.context)) {
        this.context.registerDamage({
          target: this.target,
          amount: 0,
          sourceId: this.user?.id,
          flags: { shieldBlocked: true },
        });

        return this._buildShieldBlockResult();
      }
    }

    return null;
  }

  _rollEvasion() {
    const editMode = this.context?.editMode ?? {};
    const chance = Number(this.target.Evasion) || 0;

    if (debugMode) {
      console.log("🔥 _rollEvasion chamado:", {
        attacker: this.attacker.name,
        target: this.target.name,
        evasion: chance,
        editMode,
      });
    }

    // 1️⃣ Override absoluto (debug)
    if (editMode.alwaysEvade) {
      return {
        attempted: true,
        evaded: true,
        log: `\n${formatChampionName(this.target)} evadiu automaticamente.`,
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
      log: `\n${formatChampionName(this.target)} tentou esquivar o ataque... !`,
    };
  }

  _processCrit() {
    if (debugMode) {
      console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${this.damage}`);
    }

    const chance = Math.min(this.user?.Critical || 0, MAX_CRIT_CHANCE);

    let crit = {
      chance,
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };

    if (chance > 0 || this.critOptions?.force || this.critOptions?.disable) {
      crit = this._rollCrit();
    }

    const critBonusFactor = crit.bonus / 100;
    const critExtra = this.damage * critBonusFactor;

    crit.critBonusFactor = critBonusFactor;
    crit.critExtra = critExtra;

    if (crit.didCrit) {
      emitCombatEvent(
        "onCriticalHit",
        {
          attacker: this.user,
          critSrc: this.user,
          target: this.target,
          context: this.context,
          forced: crit.forced,
        },
        this.allChampions,
      );
    }

    this.crit = crit;

    if (debugMode) console.groupEnd();
  }

  _applyDamageModifiers() {
    if (!this.user?.getDamageModifiers) {
      if (debugMode) {
        console.log(`⚠️ [MODIFIERS] Nenhum modificador de dano disponível`);
      }
      return;
    }

    if (debugMode) {
      console.group(`🔧 [DAMAGE MODIFIERS]`);
      console.log(`📍 Damage Inicial: ${this.damage}`);
    }

    this.user.purgeExpiredModifiers(this.context.currentTurn);

    const modifiers = this.user.getDamageModifiers();

    if (debugMode) {
      console.log(`🎯 Total de modificadores: ${modifiers.length}`);
    }

    for (let i = 0; i < modifiers.length; i++) {
      const mod = modifiers[i];

      if (debugMode) {
        console.log(
          `  └─ Modifier ${i + 1}: name='${mod.name || "Unknown"}' | damage=${this.damage}`,
        );
      }

      if (mod.apply) {
        const oldDamage = this.damage;

        const out = mod.apply({
          baseDamage: this.damage,
          user: this.user,
          target: this.target,
          skill: this.skill,
        });

        if (typeof out === "number") {
          this.damage = out;

          if (debugMode) {
            console.log(
              `     ✏️ Aplicado: ${oldDamage} → ${this.damage} (Δ ${this.damage - oldDamage})`,
            );
          }
        }
      }
    }

    if (debugMode) {
      console.log(`📊 Damage Final: ${this.damage}`);
      console.groupEnd();
    }
  }

  _runBeforeHooks() {
    if (this.mode === DamageEvent.Modes.ABSOLUTE) return;

    const beforeDeal = this._applyBeforeDealingPassive({
      mode: this.mode,
      skill: this.skill,
      damage: this.damage,
      crit: this.crit,
      attacker: this.user,
      target: this.target,
      context: this.context,
      allChampions: this.allChampions,
    });

    if (beforeDeal?.damage !== undefined) {
      this.damage = beforeDeal.damage;
    }

    if (beforeDeal?.crit !== undefined) {
      this.crit = beforeDeal.crit;
    }

    if (beforeDeal?.logs?.length) {
      this.beforeLogs.push(...beforeDeal.logs);
    }

    const beforeTake = this._applyBeforeTakingPassive({
      mode: this.mode,
      skill: this.skill,
      damage: this.damage,
      crit: this.crit,
      dmgSrc: this.user,
      dmgReceiver: this.target,
      context: this.context,
      allChampions: this.allChampions,
    });

    if (beforeTake?.damage !== undefined) {
      this.damage = beforeTake.damage;
    }

    if (beforeTake?.crit !== undefined) {
      this.crit = beforeTake.crit;
    }

    if (beforeTake?.logs?.length) {
      this.beforeLogs.push(...beforeTake.logs);
    }
  }

  _prepareDamage() {
    if (this.mode === DamageEvent.Modes.ABSOLUTE) return;

    this._processCrit();

    this._applyDamageModifiers();
  }
}
