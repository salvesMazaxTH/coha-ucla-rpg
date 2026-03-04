import { formatChampionName } from "./formatters.js";
import { emitCombatEvent } from "./combatEvents.js";

export class DamageEvent {
  static Modes = {
    STANDARD: "standard",
    HYBRID: "hybrid",
    ABSOLUTE: "absolute",
  };

  static ELEMENT_CYCLE = ["fire", "ice", "earth", "lightning", "water"];

  static GLOBAL_DMG_CAP = 999;

  static debugMode = false;

  static DEFAULT_CRIT_BONUS = 55;
  static MAX_CRIT_CHANCE = 95;

  constructor(params) {
    const { user, attacker, target, skill, context, baseDamage } = params;

    this.mode = params.mode ?? DamageEvent.Modes.STANDARD;

    this.baseDamage = Number(baseDamage ?? 0);
    this.damage = this.baseDamage;

    this.piercingPortion = params.piercingPortion || 0;

    this.attacker = user ?? attacker;
    this.target = target;
    this.skill = skill;

    this.context = context ?? {};
    this.allChampions = Array.isArray(params.allChampions)
      ? params.allChampions
      : [];
    console.log("DEBUG allChampions in DamageEvent:", this.allChampions);
    this.critOptions = params.critOptions ?? [];

    this.damageDepth = this.context.damageDepth ?? 0;

    // 🔥 ESTADO INTERNO
    this.crit = { didCrit: false };
    this.actualDmg = 0;
    this.hpAfter = null;

    this.preMitigatedDamage = 0;
    this.finalDamage = 0;

    this.beforeLogs = [];
    this.afterLogs = [];
    this.extraResults = [];
    this.lifesteal = null;

    this.context.extraDamageQueue ??= [];
    /* this.context.extraLogs ??= []; */
    this.context.extraEffects ??= [];
  }

  execute() {
    // 1. Checks iniciais (pode interromper o evento)
    const earlyExit = this.preChecks();
    if (earlyExit) return earlyExit;

    // 2. Cálculos de Atacante (Crit, Afinidade, Modificadores)
    this.prepareDamage();

    // 3. Hooks de Pré-Dano (Passivas que alteram valor)
    this.runBeforeHooks();

    // 4. Mitigação e Defesa (Cálculo matemático final)
    this.composeFinalDamage();

    // 5. Aplicação no HP
    this.applyDamage();

    // 6. Mecânicas de Execução (Morte instantânea)
    this.processExecuteIfNeeded();

    // 7. Hooks de Pós-Dano (Lifesteal, On-Hit)
    this.runAfterHooks();

    // 8. Reações (Reflect, Thorns, Chain)
    this.processExtraQueue();

    this.context.ignoreMinimumFloor = false;

    // 9. Construção do Pacote Final
    return this.buildFinalResult();
  }

  // ==========================================================
  // FLUXO PRINCIPAL
  // ==========================================================
  preChecks() {
    /*     console.log("DEBUG ATTACKER:", this.attacker);
    console.log("DEBUG TARGET:", this.target); */
    // 1️⃣ IMUNIDADE
    if (this.target.hasKeyword?.("imunidade absoluta")) {
      return this._buildImmuneResult();
    }

    // 2️⃣ ESQUIVA
    if (
      this.mode !== DamageEvent.Modes.ABSOLUTE &&
      !this.skill?.cannotBeEvaded
    ) {
      const evasion = DamageEvent._rollEvasion({
        attacker: this.attacker,
        target: this.target,
        context: this.context,
      });

      if (evasion?.evaded) {
        this.context.registerDamage({
          target: this.target,
          amount: 0,
          sourceId: this.attacker?.id,
          flags: { evaded: true },
        });

        return {
          totalDamage: 0,
          evaded: true,
          targetId: this.target.id,
          userId: this.attacker.id,
        };
      }
    }

    // 3️⃣ SHIELD BLOCK
    /* if (
      this.mode !== DamageEvent.Modes.ABSOLUTE &&
      !this.skill?.cannotBeBlocked
    ) {
      if (this.target._checkAndConsumeShieldBlock?.(this.context)) {
        this.context.registerDamage({
          target: this.target,
          amount: 0,
          sourceId: this.attacker?.id,
          flags: { shieldBlocked: true },
        });

        return this._buildShieldBlockResult();
      }
    } */
    return null;
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

    // Consolida logs e efeitos no estado da classe/contexto
    if (deal.logs.length) this.beforeLogs.push(...deal.logs);
    if (take.logs.length) this.beforeLogs.push(...take.logs);

    if (deal.effects.length) this.context.extraEffects.push(...deal.effects);
    if (take.effects.length) this.context.extraEffects.push(...take.effects);
  }

  composeFinalDamage() {
    if (DamageEvent.debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);
    // 1. Tira a foto do dano máximo alcançado antes do alvo se defender
    this.preMitigationDamage = this.damage;
    console.log(`📸 Dano pré-mitigação: ${this.preMitigationDamage}`);

    this.crit ??= { didCrit: false, critExtra: 0 };

    const damageOverride = this.context?.editMode?.damageOutput;

    if (damageOverride != null) {
      this.damage = damageOverride;
      if (DamageEvent.debugMode) console.groupEnd();
      return;
    }

    // ---------------- ABSOLUTE ----------------
    if (this.mode === DamageEvent.Modes.ABSOLUTE) {
      // dano absoluto ignora tudo: defesa, crítico, modificadores, afinidade, etc

      if (DamageEvent.debugMode) {
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
      this.damage = Math.max(
        this.damage - this.damage * defensePercent - flatReduction,
        0,
      );
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

    this.damage = Math.min(
      DamageEvent._roundToFive(this.damage),
      DamageEvent.GLOBAL_DMG_CAP,
    );

    // 2. Tira a foto do dano matemático final, pronto para ser aplicado
    this.finalDamage = this.damage;

    if (DamageEvent.debugMode) {
      console.log(`📈 Final: ${this.finalDamage}`);
      console.groupEnd();
    }
  }

  applyDamage() {
    if (DamageEvent.debugMode) console.group(`❤️ [APLICANDO DANO]`);
    if (DamageEvent.debugMode) {
      console.log(`👤 Target: ${this.target.name}`);
      console.log(`📍 HP Antes: ${this.target.HP}/${this.target.maxHP}`);
      console.log(`💥 Dano: ${this.damage}`);
    }

    const hpBefore = this.target.HP;

    const val = this.damage;

    this.target.takeDamage(val, this.context);

    console.log(
      `➡️ [applyDamage] Dano aplicado, após takeDamage: ${val}, HP de ${this.target.name}: ${this.target.HP}/${this.target.maxHP}`,
    );

    this.hpAfter = this.target.HP;
    this.actualDmg = hpBefore - this.hpAfter;

    this.context.registerDamage({
      target: this.target,
      amount: this.finalDamage,
      sourceId: this.attacker?.id,
      isCritical: this.crit?.didCrit,
      flags: {
        evaded: this.context.evasionAttempt ? false : undefined,
      },
    });

    if (DamageEvent.debugMode) {
      console.log(`📍 HP Depois: ${this.hpAfter}/${this.target.maxHP}`);
      console.log(`✅ Dano efetivo: ${this.actualDmg}`);
      if (this.hpAfter <= this.target.maxHP * 0.2)
        console.log(`🚨 ALERTA: Target em perigo! (<20% HP)`);
      if (this.hpAfter <= 0) console.log(`💀 Target DERROTADO!`);
      console.groupEnd();
    }
  }

  processExecuteIfNeeded() {
    console.log("🔥 _processExecuteIfNeeded chamado:", {
      target: this.target.name,
      hp: this.target.HP,
      maxHP: this.target.maxHP,
    });
    const rule = this.skill?.executeRule;
    if (!rule) return;

    // caso já esteja morto
    if (this.target.alive === false) return;

    // aliados não se executam
    if (this.target.team === this.attacker.team) return;

    let threshold = rule(this);

    const override = this.context?.editMode?.executionOverride;

    if (typeof override === "number") {
      threshold = override;
    }

    const hpPercent = this.target.HP / this.target.maxHP;

    if (hpPercent <= threshold && this.target.HP > 0) {
      const dmg = this.target.HP;

      this.target.HP = 0;
      this.target.alive = false;

      this.context.registerDamage({
        target: this.target,
        amount: dmg,
        sourceId: this.attacker?.id,
        flags: { isExecute: true },
      });
    }
  }

  runAfterHooks() {
    // 1. Executa hooks de passivas
    const afterTake = this._applyAfterTakingPassive();
    const afterDeal = this._applyAfterDealingPassive();

    // 2. Sincroniza logs e efeitos das passivas
    if (afterTake.logs.length) this.afterLogs.push(...afterTake.logs);
    if (afterDeal.logs.length) this.afterLogs.push(...afterDeal.logs);

    if (afterTake.effects.length)
      this.context.extraEffects.push(...afterTake.effects);
    if (afterDeal.effects.length)
      this.context.extraEffects.push(...afterDeal.effects);

    // 3. Processa Lifesteal
    const lsResult = this._applyLifeSteal();

    if (lsResult) {
      // Salva na instância para o buildFinalResult usar
      this.lifesteal = lsResult;

      // Adiciona o log do lifesteal e de possíveis passivas ativadas por ele
      this.afterLogs.push(lsResult.log);
      if (lsResult.passiveLogs.length) {
        this.afterLogs.push(...lsResult.passiveLogs);
      }
    }
  }

  processExtraQueue() {
    const queue = this.context.extraDamageQueue || [];
    if (queue.length === 0) return [];

    console.log(
      `🔥 processExtraQueue: Processando ${queue.length} eventos extras.`,
    );

    // Limpa a fila original para evitar loops infinitos caso os novos eventos gerem mais eventos
    const itemsToProcess = [...queue];
    this.context.extraDamageQueue = [];

    const results = [];

    for (const extra of itemsToProcess) {
      // 1. Criamos uma nova instância para o evento extra (Reflect, Thorns, etc)
      const extraEvent = new DamageEvent({
        ...extra, // baseDamage, user, target, skill, etc.
        allChampions: this.allChampions,
        context: {
          ...this.context,
          // Incrementa a profundidade para evitar recursão infinita (trava em 2 ou 3)
          damageDepth: (this.context.damageDepth || 0) + 1,
          origin: extra.skill?.key || "reaction",
          // Importante: Passamos a referência da fila limpa para o novo evento
          extraDamageQueue: this.context.extraDamageQueue,
        },
      });

      // 2. Executamos a pipeline completa do novo evento
      const result = extraEvent.execute();

      // 3. Acumulamos o resultado formatado
      if (Array.isArray(result)) results.push(...result);
      else if (result) results.push(result);
    }

    // Armazena no estado interno da instância atual para o buildFinalResult consolidar depois
    this.extraResults.push(...results);
    return results;
  }

  buildFinalResult() {
    // Consolida todos os logs (os da pipeline + os que hooks podem ter jogado no context)
    const allLogs = [
      ...this.beforeLogs,
      ...this.afterLogs,
      // ...(this.context.extraLogs || []),
    ];

    let finalLog = DamageEvent._buildLog(
      this.attacker,
      this.target,
      this.skill,
      this.actualDmg,
      this.crit,
      this.hpAfter,
    );

    if (allLogs.length) {
      finalLog += "\n" + allLogs.join("\n");
    }

    if (DamageEvent.debugMode) console.groupEnd(); // Fecha o grupo principal do CombatResolver

    const mainResult = {
      totalDamage: this.actualDmg,
      finalHP: this.target.HP,
      targetId: this.target.id,
      userId: this.attacker.id,
      log: finalLog,
      crit: this.crit,
      damageDepth: this.context.damageDepth,
      skill: this.skill,
      // Incluímos a jornada do dano para debug/painéis se necessário
      journey: {
        base: this.originalBaseDamage,
        mitigated: this.finalDamage,
        actual: this.actualDmg,
      },
    };

    // Se houver contra-ataques/reflects, retorna um array, senão o objeto único
    return this.extraResults.length > 0
      ? [mainResult, ...this.extraResults]
      : mainResult;
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

    const chance = Math.min(user?.Critical || 0, DamageEvent.MAX_CRIT_CHANCE);
    const bonus = user?.critBonusOverride || DamageEvent.DEFAULT_CRIT_BONUS;

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

    if (DamageEvent.debugMode) {
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
    if (DamageEvent.debugMode) console.group(`🛡️ [DEFENSE DEBUG]`);

    if (!defense) {
      if (DamageEvent.debugMode) {
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

    if (DamageEvent.debugMode) {
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

    if (DamageEvent.debugMode) {
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

    if (DamageEvent.debugMode) {
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

  static _buildLog(user, target, skill, dmg, crit, hpAfter) {
    const userName = formatChampionName(user);
    const targetName = formatChampionName(target);

    // skill pode ser objeto ou string
    const skillName = skill && typeof skill === "object" ? skill.name : skill;
    let log = `${userName} usou ${skillName} e causou ${dmg} de dano a ${targetName}`;

    if (crit.didCrit)
      log += ` (CRÍTICO ${(1 + crit.critBonusFactor).toFixed(2)}x)`;

    log += `\nHP final de ${targetName}: ${hpAfter}/${target.maxHP}`;

    return log;
  }

  // ===============================
  // MÉTODOS UTILITÁRIOS DE PROCESSAMENTO DE DANO
  // ===============================

  _buildImmuneResult() {
    // Usamos as propriedades que já existem na instância
    const targetName = formatChampionName(this.target);
    const username = formatChampionName(this.attacker);
    const skillName = this.skill?.name || "habilidade";

    return {
      baseDamage: this.baseDamage,
      totalDamage: 0,
      finalHP: this.target.HP,
      targetId: this.target.id,
      userId: this.attacker.id,
      evaded: false,
      immune: true, // Adicionado para facilitar a identificação no front
      log: `${username} tentou usar ${skillName} em ${targetName}, mas o alvo possui Imunidade Absoluta!`,
      crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
    };
  }

  _buildShieldBlockResult() {
    const targetName = formatChampionName(this.target);
    const username = formatChampionName(this.attacker);
    const skillName = this.skill?.name || "habilidade";

    return {
      baseDamage: this.baseDamage,
      totalDamage: 0,
      finalHP: this.target.HP,
      targetId: this.target.id,
      userId: this.attacker.id,
      shieldBlocked: true,
      evaded: false,
      log: `${username} usou ${skillName} em ${targetName}, mas o escudo de ${targetName} bloqueou completamente e se dissipou!`,
      crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
    };
  }

  _processCrit() {
    if (DamageEvent.debugMode) {
      console.group(`⚔️ [CRÍTICO PROCESSING] - Damage Base: ${this.damage}`);
    }

    const chance = Math.min(
      this.attacker?.Critical || 0,
      DamageEvent.MAX_CRIT_CHANCE,
    );

    this.crit = {
      chance,
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };

    if (chance > 0 || this.critOptions?.force || this.critOptions?.disable) {
      const rolled = DamageEvent._rollCrit(
        this.attacker,
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
          attacker: this.attacker,
          critSrc: this.attacker,
          target: this.target,
          context: this.context,
          forced: this.crit.forced,
        },
        this.allChampions,
      );
    }

    if (DamageEvent.debugMode) console.groupEnd();
  }

  _applyDamageModifiers() {
    if (!this.attacker?.getDamageModifiers) {
      if (DamageEvent.debugMode) {
        console.log(`⚠️ [MODIFIERS] Nenhum modificador de dano disponível`);
      }
      return;
    }

    if (DamageEvent.debugMode) {
      console.group(`🔧 [DAMAGE MODIFIERS]`);
      console.log(`📍 Damage Inicial: ${this.damage}`);
    }

    this.attacker.purgeExpiredModifiers(this.context.currentTurn);

    const modifiers = this.attacker.getDamageModifiers();

    if (DamageEvent.debugMode) {
      console.log(`🎯 Total de modificadores: ${modifiers.length}`);
    }

    for (let i = 0; i < modifiers.length; i++) {
      const mod = modifiers[i];

      if (DamageEvent.debugMode) {
        console.log(
          `  └─ Modifier ${i + 1}: name='${mod.name || "Unknown"}' | damage=${this.damage}`,
        );
      }

      if (mod.apply) {
        const oldDamage = this.damage;

        const out = mod.apply({
          baseDamage: this.damage,
          user: this.attacker,
          target: this.target,
          skill: this.skill,
        });

        if (typeof out === "number") {
          this.damage = out;

          if (DamageEvent.debugMode) {
            console.log(
              `     ✏️ Aplicado: ${oldDamage} → ${this.damage} (Δ ${this.damage - oldDamage})`,
            );
          }
        }
      }
    }

    if (DamageEvent.debugMode) {
      console.log(`📊 Damage Final: ${this.damage}`);
      console.groupEnd();
    }
  }

  _applyAffinity() {
    const skillElement = this.skill?.element;

    if (!skillElement) return;
    if (!this.target?.elementalAffinities?.length) return;

    if (DamageEvent.debugMode) {
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

      this.context.visual.dialogEvents ??= [];
      this.context.visual.dialogEvents.push({
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

  // --- HOOKS DE PRÉ-DANO (Before) ---
  _applyBeforeDealingPassive() {
    return this._processHook("onBeforeDmgDealing", {
      mode: this.mode,
      damage: this.damage,
      crit: this.crit,
      skill: this.skill,
      attacker: this.attacker,
      target: this.target,
      dmgSrc: this.attacker,
      dmgReceiver: this.target,
      context: this.context,
    });
  }

  _applyBeforeTakingPassive() {
    return this._processHook("onBeforeDmgTaking", {
      mode: this.mode,
      damage: this.damage,
      crit: this.crit,
      skill: this.skill,
      attacker: this.attacker,
      target: this.target,
      dmgSrc: this.attacker,
      dmgReceiver: this.target,
      context: this.context,
    });
  }

  // Helper privado para evitar duplicar o loop de logs/effects/damage
  _processHook(eventName, payload) {
    // JSON.stringify força o JS a ler o valor exato AGORA, sem preguiça de log
    console.log(
      `🔍 DEBUG SEGURO [${eventName}]:`,
      JSON.stringify(this.allChampions),
    );

    // Verifique se o this.allChampions não foi redefinido por acidente
    if (!this.allChampions || this.allChampions.length === 0) {
      console.error("❌ ERRO CRÍTICO: allChampions sumiu antes do emit!");
    }
    const results =
      emitCombatEvent(eventName, payload, this.allChampions) || [];
    const summary = { logs: [], effects: [] };

    for (const r of results) {
      if (!r) continue;

      // Caso legado: Array direto de logs
      if (Array.isArray(r)) {
        summary.logs.push(...r);
        continue;
      }

      // Mutação de estado do evento
      if (r.damage !== undefined) this.damage = r.damage;
      if (r.crit !== undefined) this.crit = r.crit;

      // Consolidação de Logs e Effects (Uso de set de chaves para enxugar)
      ["log", "logs"].forEach((key) => {
        if (r[key]) {
          const val = Array.isArray(r[key]) ? r[key] : [r[key]];
          summary.logs.push(...val);
        }
      });

      if (r.effects?.length) summary.effects.push(...r.effects);
    }
    return summary;
  }

  _applyLifeSteal() {
    if (DamageEvent.debugMode) console.group(`💉 [LIFESTEAL]`);

    // 1. Validações iniciais usando os dados da instância
    const lsRate = this.attacker.LifeSteal || 0;
    if (lsRate <= 0 || this.actualDmg <= 0 || this.context.isDot) {
      if (DamageEvent.debugMode) {
        console.log(
          `⚠️ Pulando Lifesteal: LS=${lsRate}%, DMG=${this.actualDmg}`,
        );
        console.groupEnd();
      }
      return null;
    }

    // 2. Cálculo do heal (usando o arredondamento padrão da sua classe)
    const rawHeal = (this.actualDmg * lsRate) / 100;
    const heal = Math.max(5, DamageEvent._roundToFive(rawHeal));

    const hpBefore = this.attacker.HP;
    const effectiveHeal = Math.min(heal, this.attacker.maxHP - hpBefore);

    if (effectiveHeal <= 0) {
      if (DamageEvent.debugMode) console.groupEnd();
      return null;
    }

    // 3. Aplica a cura
    this.attacker.heal(effectiveHeal, { suppressHealEvents: true });

    // 4. Dispara evento para passivas reativas a lifesteal (ex: "ao curar, ganhe buff")
    const results =
      emitCombatEvent(
        "onAfterLifeSteal",
        {
          source: this.attacker,
          amount: effectiveHeal,
          context: this.context,
        },
        this.allChampions,
      ) || [];

    // 5. Coleta logs de passivas que reagiram ao lifesteal
    const passiveLogs = [];
    for (const r of results) {
      if (r?.log) {
        if (Array.isArray(r.log)) passiveLogs.push(...r.log);
        else passiveLogs.push(r.log);
      }
    }

    if (DamageEvent.debugMode) {
      console.log(
        `📊 Efetivo: ${effectiveHeal} (HP: ${this.attacker.HP}/${this.attacker.maxHP})`,
      );
      console.groupEnd();
    }

    return {
      amount: effectiveHeal,
      log: `Roubo de vida: ${effectiveHeal} | HP: ${this.attacker.HP}/${this.attacker.maxHP}`,
      passiveLogs,
    };
  }

  _applyAfterTakingPassive() {
    return this._processHook("onAfterDmgTaking", {
      attacker: this.attacker,
      target: this.target,
      dmgSrc: this.attacker,
      dmgReceiver: this.target,
      skill: this.skill,
      damage: this.damage,
      mode: this.mode,
      crit: this.crit,
      context: this.context,
    });
  }

  _applyAfterDealingPassive() {
    if (this.context?.isDot) return { logs: [], effects: [] };
    return this._processHook("onAfterDmgDealing", {
      attacker: this.attacker,
      target: this.target,
      dmgSrc: this.attacker,
      dmgReceiver: this.target,
      damage: this.damage,
      mode: this.mode,
      crit: this.crit,
      skill: this.skill,
      context: this.context,
    });
  }
}
