class DamageEvent {
  static Modes = {
    STANDARD: "standard",
    HYBRID: "hybrid",
    ABSOLUTE: "absolute",
  };

  static ELEMENT_CYCLE = ["fire", "ice", "earth", "lightning", "water"];

  constructor(params) {
    this.mode = params.mode ?? DamageEvent.Modes.STANDARD;

    this.baseDamage = Number(params.baseDamage ?? 0);
    this.damage = this.baseDamage;

    this.piercingPortion = params.piercingPortion || 0;

    this.user = params.user;
    this.target = params.target;
    this.skill = params.skill;

    this.context = params.context ?? {};
    this.allChampions = Array.isArray(params.allChampions)
      ? params.allChampions
      : [];
    this.critOptions = params.critOptions ?? [];

    this.damageDepth = this.context.damageDepth ?? 0;

    // 🔥 ESTADO INTERNO
    this.crit = { didCrit: false };
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
    const early = this.preChecks();
    if (early) {
      return early;
    }
    this.prepareDamage();
    this.runBeforeHooks();
    this.composeFinalDamage();
    this.applyDamage();
    this.processExecuteIfNeeded();
    this.runAfterHooks();
    this.processExtraQueue();

    return this._buildFinalResult();
  }

  // ==========================================================
  // FLUXO PRINCIPAL
  // ==========================================================
  preChecks() {
    // 1️⃣ IMUNIDADE
    const immunityResult = _preCheckImmunity();
    if (immunityResult) {
      return immunityResult;
    }

    function _preCheckImmunity() {
      const isImmune = this.target.hasKeyword?.("imunidade absoluta");
      if (isImmune) {
        return this._buildImmuneResult();
      }
    }
    // --------------------------------------------
    // 2️⃣ ESQUIVA
    const evasionResult = _preCheckEvasion();
    if (evasionResult) {
      return evasionResult;
    }

    function _preCheckEvasion() {
      if (
        this.mode !== DamageEvent.Modes.ABSOLUTE &&
        !this.skill?.cannotBeEvaded
      ) {
        const evasion = DamageEvent._rollEvasion({
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
    }
    // --------------------------------------------
    // 3️⃣ SHIELD
    const shieldResult = _preCheckShield();

    if (shieldResult) {
      return shieldResult;
    }

    function _preCheckShield() {
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
  }

  prepareDamage() {
    if (this.mode === DamageEvent.Modes.ABSOLUTE) return;
    // ordem importa
    // crit -> modifiers -> affinity
    this._processCrit();

    this._applyDamageModifiers();

    this._applyAffinity();
  }

  runBeforeHooks() {
    if (this.mode === DamageEvent.Modes.ABSOLUTE) return;

    const deal = this._applyBeforeDealingPassive();
    const take = this._applyBeforeTakingPassive();

    if (deal.logs) this.beforeLogs.push(...deal.logs);
    if (take.logs) this.beforeLogs.push(...take.logs);

    if (deal.effects) this.context.extraEffects.push(...deal.effects);
    if (take.effects) this.context.extraEffects.push(...take.effects);
  }

  composeFinalDamage() {
    if (debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);

    this.crit ??= { didCrit: false, critExtra: 0 };

    const damageOverride = this.context?.editMode?.damageOutput;

    if (damageOverride != null) {
      this.damage = damageOverride;
      if (debugMode) console.groupEnd();
      return;
    }

    // ---------------- ABSOLUTE ----------------
    if (this.mode === DamageEvent.Modes.ABSOLUTE) {
      this.damage = this.damage;

      if (debugMode) {
        console.log("⚡ ABSOLUTE DAMAGE");
        console.log("➡️ ignora crítico, defesa e reduções");
        console.log(`📈 Final: ${this.damage}`);
        console.groupEnd();
      }

      return;
    }

    // aplica crítico
    if (this.crit.didCrit) {
      this.damage += this.crit.critExtra;
    }

    const baseDefense = this.target.baseDefense ?? this.target.Defense;
    const currentDefense = this.target.Defense;

    const defenseUsed = this.crit.didCrit
      ? Math.min(baseDefense, currentDefense)
      : currentDefense;

    const defensePercent = DamageEvent._defenseToPercent(defenseUsed);

    const flatReduction = this.target.getTotalDamageReduction?.() || 0;

    // ---------------- STANDARD ----------------
    if (this.mode === DamageEvent.Modes.STANDARD || this.piercingPortion <= 0) {
      this.damage = this.damage - this.damage * defensePercent - flatReduction;
    }

    // ------------ PIERCING / HYBRID ------------
    else if (this.piercingPortion > 0) {
      const piercing = Math.min(this.piercingPortion, this.damage);
      const standard = this.damage - piercing;

      let standardAfter = standard - standard * defensePercent - flatReduction;

      let piercingAfter = piercing - flatReduction;

      standardAfter = Math.max(standardAfter, 0);
      piercingAfter = Math.max(piercingAfter, 0);

      this.damage = standardAfter + piercingAfter;
    }

    // -------- FLOOR --------
    if (!this.context?.ignoreMinimumFloor) {
      this.damage = Math.max(this.damage, 10);
    }

    this.damage = DamageEvent._roundToFive(this.damage);

    if (debugMode) {
      console.log(`📈 Final: ${this.damage}`);
      console.groupEnd();
    }
  }

  // ==========================================================
  // UTILITÁRIOS INTERNOS
  // ==========================================================

  // ===============================
  // UTILITÁRIOS MATEMÁTICOS (ESTÁTICOS)
  // ===============================
  static _roundToFive(x) {
    return Math.round(x / 5) * 5;
  }

  static _rollCrit(user, context, critOptions = {}) {
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
      console.log(`🎯 Roll: ${roll.toFixed(2)}`);
      console.log(`🎲 Chance necessária: ${chance}%`);
      console.log(didCrit ? "✅ CRÍTICO!" : "❌ Sem crítico");
    }

    return {
      didCrit,
      bonus: didCrit ? bonus : 0,
      roll,
      forced: false,
      disabled: false,
    };
  }

  static _defenseToPercent(defense) {
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

  static _rollEvasion({ attacker, target, context }) {
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
  }

  // ===============================
  // MÉTODOS UTILITÁRIOS DE PROCESSAMENTO DE DANO
  // ===============================

  _processCrit() {
    if (debugMode) {
      console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${this.damage}`);
    }

    const chance = Math.min(this.user?.Critical || 0, MAX_CRIT_CHANCE);

    this.crit = {
      chance,
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };

    if (chance > 0 || this.critOptions?.force || this.critOptions?.disable) {
      const rolled = DamageEvent._rollCrit(
        this.user,
        this.context,
        this.critOptions,
      );

      if (rolled) Object.assign(this.crit, rolled);
    }

    const critBonusFactor = this.crit.bonus / 100;
    const critExtra = this.damage * critBonusFactor;

    this.crit.critBonusFactor = critBonusFactor;
    this.crit.critExtra = critExtra;

    if (this.crit.didCrit) {
      emitCombatEvent(
        "onCriticalHit",
        {
          attacker: this.user,
          critSrc: this.user,
          target: this.target,
          context: this.context,
          forced: this.crit.forced,
        },
        this.allChampions,
      );
    }

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

  _applyAffinity() {
    const skillElement = this.skill?.element;

    if (!skillElement) return;
    if (!this.target?.elementalAffinities?.length) return;

    if (debugMode) {
      console.log("🔥 _applyAffinity chamado:", {
        skillElement,
        target: this.target.name,
        affinities: this.target.elementalAffinities,
        damage: this.damage,
      });
    }

    let strongestRelation = "neutral";

    for (const affinity of this.target.elementalAffinities) {
      const relation = this._getElementalRelation(skillElement, affinity);

      if (relation === "weak") {
        this.damage = Math.floor(this.damage * 1.2 + 25);
        strongestRelation = "weak";
        break;
      }

      if (relation === "resist" && strongestRelation !== "weak") {
        this.damage = Math.max(this.damage - 40, 0);
        strongestRelation = "resist";
        break;
      }
    }

    if (strongestRelation !== "neutral") {
      const message =
        strongestRelation === "weak"
          ? "✨ É SUPER-EFETIVO!"
          : "🛡️ Não é muito efetivo...";

      this.context.dialogEvents ??= [];
      this.context.dialogEvents.push({
        type: "dialog",
        message,
        blocking: false,
      });
    }

    this.context.ignoreMinimumFloor = true;
  }

  _getElementalRelation(attackingElement, defendingElement) {
    const cycle = DamageEvent.ELEMENT_CYCLE;

    const index = cycle.indexOf(attackingElement);

    if (index === -1) return "neutral";

    const strongAgainst = cycle[(index + 1) % cycle.length];
    const weakAgainst = cycle[(index - 1 + cycle.length) % cycle.length];

    if (defendingElement === strongAgainst) return "weak";

    if (defendingElement === weakAgainst) return "resist";

    return "neutral";
  }

  _applyBeforeDealingPassive() {
    const results = emitCombatEvent(
      "onBeforeDmgDealing",
      {
        mode: this.mode,
        damage: this.damage,
        crit: this.crit,
        skill: this.skill,
        attacker: this.user,
        target: this.target,
        dmgSrc: this.user,
        dmgReceiver: this.target,
        context: this.context,
      },
      this.allChampions,
    );

    const logs = [];
    const effects = [];

    for (const r of results || []) {
      if (!r) continue;

      // compatibilidade com hooks antigos
      if (Array.isArray(r)) {
        logs.push(...r);
        continue;
      }

      // overrides
      if (r.damage !== undefined) {
        this.damage = r.damage;
      }

      if (r.crit !== undefined) {
        this.crit = r.crit;
      }

      // logs
      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }

      if (r.logs) {
        if (Array.isArray(r.logs)) logs.push(...r.logs);
        else logs.push(r.logs);
      }

      // effects
      if (r.effects?.length) {
        effects.push(...r.effects);
      }
    }

    return { logs, effects };
  }

  _applyBeforeTakingPassive() {
    const results = emitCombatEvent(
      "onBeforeDmgTaking",
      {
        mode: this.mode,
        damage: this.damage,
        crit: this.crit,
        skill: this.skill,
        attacker: this.user,
        target: this.target,
        dmgSrc: this.user,
        dmgReceiver: this.target,
        context: this.context,
      },
      this.allChampions,
    );

    const logs = [];
    const effects = [];

    for (const r of results || []) {
      if (!r) continue;

      if (Array.isArray(r)) {
        logs.push(...r);
        continue;
      }

      if (r.damage !== undefined) {
        this.damage = r.damage;
      }

      if (r.crit !== undefined) {
        this.crit = r.crit;
      }

      if (r.log) {
        if (Array.isArray(r.log)) logs.push(...r.log);
        else logs.push(r.log);
      }

      if (r.logs) {
        if (Array.isArray(r.logs)) logs.push(...r.logs);
        else logs.push(r.logs);
      }

      if (r.effects?.length) {
        effects.push(...r.effects);
      }
    }

    return { logs, effects };
  }
}
