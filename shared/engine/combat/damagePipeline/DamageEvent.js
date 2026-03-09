import { formatChampionName } from "../../../ui/formatters.js";
import { emitCombatEvent } from "../combatEvents.js";
import { applyAffinity } from "./damageSystems/affinitySystem.js";
import { processCrit } from "./damageSystems/critSystem.js";
import { applyDamageModifiers } from "./damageSystems/modifierSystem.js";
import { defenseToPercent } from "./damageSystems/defenseSystem.js";

export class DamageEvent {
  static Modes = {
    STANDARD: "standard",
    HYBRID: "hybrid",
    ABSOLUTE: "absolute",
  };

  static GLOBAL_DMG_CAP = 999;

  static debugMode = true;

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
    this.allChampions =
      params.allChampions instanceof Map
        ? [...params.allChampions.values()]
        : (params.allChampions ?? []);
    console.log(
      "[DamageEvent_constructor] ALL-CHAMPIONS DEBUG allChampions in DamageEvent:",
      this.allChampions,
    );
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

    // 3. Mitigação e Defesa (Cálculo matemático final)
    this.composeFinalDamage();

    // 4. Hooks Pré-Aplicação do Dano (Passivas que alteram valor)
    this.runBeforeHooks();

    // 5. Aplicação no HP
    this.applyDamage();

    // 6. Mecânicas de Execução (Morte instantânea)
    this.processObliterateIfNeeded();

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
    const results = emitCombatEvent(
      "onDamageIncoming",
      {
        dmgReceiver: this.target,
        dmgSrc: this.attacker,
        damage: this.damage,
      },
      this.allChampions,
    );

    for (const r of results) {
      if (r?.message) {
        this.context?.logs?.push?.(r.message);
      }

      if (r?.cancel) {
        console.log(
          `[DAMAGE CANCEL] ${this.target.name} teve o dano cancelado por status-effect`,
        );
        return this._buildImmuneResult();
      }
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
    processCrit(this, DamageEvent.debugMode);

    applyDamageModifiers(this, DamageEvent.debugMode);

    applyAffinity(this, DamageEvent.debugMode);
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

    const defensePercent = defenseToPercent(defenseUsed, DamageEvent.debugMode);

    const { flat, percent } = this.target.getTotalDamageReduction?.() || {
      flat: 0,
      percent: 0,
    };

    // ---------------- STANDARD ----------------
    if (this.mode === DamageEvent.Modes.STANDARD || this.piercingPortion <= 0) {
      const debug = DamageEvent.debugMode;

      if (debug) {
        console.log(`[DAMAGE COMPOSITION] 📸 Base damage: ${this.damage}`);
      }

      // Defesa
      const defenseMitigation = this.damage * defensePercent;
      this.damage = Math.max(this.damage - defenseMitigation, 0);

      if (debug) {
        console.log(
          `[DAMAGE COMPOSITION] 🛡️ Após defesa (${(
            defensePercent * 100
          ).toFixed(1)}%): ${this.damage}`,
        );
      }

      // Redução percentual
      this.damage *= 1 - percent / 100;

      if (debug) {
        console.log(
          `[DAMAGE COMPOSITION] 📉 Após redução percentual (${percent}%): ${this.damage}`,
        );
      }

      // Redução flat
      this.damage = Math.max(this.damage - flat, 0);

      if (debug) {
        console.log(
          `[DAMAGE COMPOSITION] 🧱 Após redução flat (${flat}): ${this.damage}`,
        );
      }
    }

    // ------------ PIERCING / HYBRID ------------
    else if (this.piercingPortion > 0) {
      const piercing = Math.min(this.piercingPortion, this.damage);
      const standard = this.damage - piercing;

      let standardAfter =
        (standard - standard * defensePercent - flat) * (1 - percent / 100);

      let piercingAfter = piercing - flat; // redução flat afeta o dano perfurante, mas não a redução percentual

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

    const damageOverride = this.context?.editMode?.damageOutput;
    console.log(
      `📸 [DAMAGE COMPOSITION] Dano final calculado (antes de overrides): ${this.damage}`,
    );

    if (damageOverride != null) {
      this.damage = damageOverride;
      console.log(
        `⚡ [DAMAGE COMPOSITION] Override de dano ativado! Dano forçado para: ${this.damage}`,
      );
      if (DamageEvent.debugMode) console.groupEnd();
    }

    this.finalDamage = this.damage;

    if (DamageEvent.debugMode) {
      console.log(`[DAMAGE COMPOSITION] 📈 Final: ${this.finalDamage}`);
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

    const damageToApply = this.damage;

    console.log(`[DAMAGE COMPOSITION] damageToApply: ${damageToApply}`);
    console.log(`[DAMAGE COMPOSITION] hpBefore: ${hpBefore}`);

    this.target.takeDamage(damageToApply, this.context);

    console.log(
      `➡️ [applyDamage] Dano aplicado, após takeDamage: ${damageToApply}, HP de ${this.target.name}: ${this.target.HP}/${this.target.maxHP}`,
    );

    this.hpAfter = this.target.HP;
    this.actualDmg = hpBefore - this.hpAfter;

    this.context.registerDamage({
      target: this.target,
      amount: damageToApply,
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

  processObliterateIfNeeded() {
    console.log("🔥 _processObliterateIfNeeded chamado:", {
      target: this.target.name,
      hp: this.target.HP,
      maxHP: this.target.maxHP,
    });
    const rule = this.skill?.obliterateRule;
    if (!rule) return;

    // caso já esteja morto
    if (this.target.alive === false) return;

    // aliados não se executam
    if (this.target.team === this.attacker.team) return;

    if (this.target.runtime?.preventObliterate) {
      console.log("[OBLITERATE] Cancelado por efeito de sobrevivência");
      return;
    }

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
        flags: { isObliterate: true },
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

    this.context.registerDamage({
      target: this.target,
      amount: 0,
      sourceId: this.attacker?.id,
      flags: { immune: true },
    });

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
    console.log("[ALL CHAMPIONS DEBUG]", this.allChampions);

    // Verifique se o this.allChampions não foi redefinido por acidente
    if (!this.allChampions || this.allChampions.length === 0) {
      /*  console.error("❌ ERRO CRÍTICO: allChampions sumiu antes do emit!"); */
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
