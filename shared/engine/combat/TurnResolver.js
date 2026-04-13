import { formatChampionName } from "../../ui/formatters.js";
import { emitCombatEvent } from "./combatEvents.js";
import { snapshotChampions } from "./snapshotChampions.js";

export class TurnResolver {
  constructor(match, editMode, options = {}) {
    this.match = match;
    this.combat = match.combat;
    this.editMode = editMode ?? {};
    this.mutationHandler =
      typeof options?.mutationHandler === "function"
        ? options.mutationHandler
        : null;
  }

  // ============================================================
  //  RESOLUÇÃO DO TURNO (entry point)
  // ============================================================

  resolveTurn() {
    const actionResults = [];
    // Lógica de trocas/switches desativada: mantido apenas para compatibilidade
    // de shape com o servidor.
    const switchResults = [];
    let actionOrder = 0;

    const turnExecutionMap = new Map(); // championId -> executionIndex

    while (this.combat.pendingActions.length > 0) {
      const actions = this.combat.pendingActions;

      actions.sort((a, b) => {
        const pA = a.getPriority(this.match);
        const pB = b.getPriority(this.match);
        if (pA !== pB) return pB - pA;

        const sA = a.getSpeed(this.match);
        const sB = b.getSpeed(this.match);
        if (sA !== sB) return sB - sA;

        return Math.random() - 0.5; // desempate aleatório para ações com mesma prioridade e velocidade
      });

      const action = actions.shift(); // remove a próxima ação

      // Lógica de trocas/switches desativada.
      // if (action.type === "switch") {
      //   const switchResult = this.executeSwitch(action);
      //   if (switchResult) switchResults.push(switchResult);
      //   continue;
      // }

      // 🔹 registra a posição da execução
      action.executionIndex = actionOrder++;

      const user = this.combat.activeChampions.get(action.userId);

      if (!user) {
        this.refundActionResource(user, action);
        actionResults.push({
          executed: false,
          reason: "inactive",
          user,
          action,
          logMessage: `Ação de campeão desconhecido ignorada (não ativo).`,
        });
        continue;
      }

      turnExecutionMap.set(user.id, action.executionIndex);

      const context = this.createBaseContext({ sourceId: user.id });
      context.executionIndex = action.executionIndex;
      context.turnExecutionMap = turnExecutionMap;

      const result = this.executeSkillAction(action, turnExecutionMap, context);
      actionResults.push(result);

      const repeat = result?.repeatActionRequest;
      actionOrder = this.handleRepeatAction(
        repeat,
        action,
        actionOrder,
        actionResults,
        turnExecutionMap,
      );
    }

    const deathContext = this.createBaseContext({ sourceId: null });
    const deathResults = this.processChampionDeaths(3, deathContext);

    return { actionResults, deathResults, switchResults };
  }

  // ============================================================
  //  EXECUÇÃO DE SWITCH (DESATIVADA)
  // ============================================================

  // executeSwitch(action) {
  //   const outId = action.championToSwitchOutId ?? action.userId;
  //   if (outId) {
  //     const champion = this.combat.activeChampions.get(outId);
  //     if (champion) {
  //       action.switchedOutChampion = champion; // passado ao servidor para bookkeeping (bench, slot, efeitos)
  //       this.combat.activeChampions.delete(outId);
  //     }
  //   }
  //   return action;
  // }

  // ============================================================
  //  MANIPULAÇÃO DE REPEAT ACTION (Passivas)
  // ============================================================

  handleRepeatAction(
    repeat,
    baseAction,
    actionOrder,
    actionResults,
    turnExecutionMap,
  ) {
    if (!repeat?.userId || !repeat?.skillKey) return actionOrder;

    const repeatAction = {
      userId: repeat.userId,
      skillKey: repeat.skillKey,
      targetIds: repeat.targetIds ?? {},
      priority: Number.isFinite(repeat.priority)
        ? repeat.priority
        : (baseAction.priority ?? 0),
      speed: Number.isFinite(repeat.speed)
        ? repeat.speed
        : (baseAction.speed ?? 0),
      turn: baseAction.turn,
      ultCost: 0,
      type: "followUp",
    };

    repeatAction.executionIndex = actionOrder++;

    const repeatContext = this.createBaseContext({
      sourceId: repeat.userId,
    });

    repeatContext.executionIndex = repeatAction.executionIndex;
    repeatContext.turnExecutionMap = turnExecutionMap;
    repeatContext.isPassiveRepeat = true;

    const repeatResult = this.executeSkillAction(
      repeatAction,
      turnExecutionMap,
      repeatContext,
    );

    actionResults.push(repeatResult);
    return actionOrder;
  }

  // ============================================================
  //  PROCESSAMENTO DE MORTES
  // ============================================================

  processChampionDeaths(maxScore = 3, context = null) {
    const results = [];
    for (const champ of this.combat.activeChampions.values()) {
      if (!champ.alive) {
        const result = this.match.removeChampionFromGame(champ.id, maxScore);
        if (result) results.push(result);

        if (context) {
          emitCombatEvent(
            "onChampionDeath",
            { deadChampion: champ, context },
            this.combat.activeChampions,
          );
        }
      }
    }
    return results;
  }

  // ============================================================
  //  EXECUÇÃO DE AÇÃO INDIVIDUAL
  // ============================================================

  executeSkillAction(action, turnExecutionMap, context) {
    // console.log("[EXECUTE SKILL ACTION] [TARGETS]", action);
    const user = this.combat.activeChampions.get(action.userId);

    // Referência a estado de "switched out" desativada junto com a lógica de switch.
    const isInactive = !user || !user.alive;

    if (isInactive) {
      const userName = user ? formatChampionName(user) : "campeão desconhecido";
      this.refundActionResource(user, action);
      return {
        executed: false,
        reason: "inactive",
        user,
        action,
        logMessage: `Ação de ${userName} ignorada (não ativo).`,
      };
    }

    const denial = this.canExecuteAction(user, action);

    if (denial?.denied) {
      context.registerDialog({
        message: denial.message || `${formatChampionName(user)} não pode agir.`,
        sourceId: user.id,
        damageDepth: context.damageDepth ?? 0,
      });

      this.refundActionResource(user, action);
      return {
        executed: false,
        reason: "denied",
        denial,
        user,
        action,
      };
    }

    const skill = user.skills.find((s) => s.key === action.skillKey);
    if (!skill) {
      this.refundActionResource(user, action);
      return {
        executed: false,
        reason: "skill_not_found",
        user,
        action,
        logMessage: `Erro: Habilidade ${action.skillKey} não encontrada para ${formatChampionName(user)}.`,
      };
    }

    const roleTargets = this.resolveSkillTargets(user, skill, action, context);

    // console.log("STEP 1 - TARGETS:", roleTargets);
    if (!roleTargets) {
      context.registerDialog({
        message: `${formatChampionName(user)} usou <b>${skill.name}</b>, mas não encontrou alvo.`,

        sourceId: user.id,
        damageDepth: context.damageDepth ?? 0,
      });

      this.registerSkillUsageInTurn(user, skill, {});

      context._intermediateSnapshot = snapshotChampions(
        this.combat.activeChampions,
      );

      return {
        executed: true,
        user,
        skill,
        context,
        action,
        results: [
          {
            log: `${formatChampionName(user)} usou <b>${skill.name}</b>, mas não encontrou alvo.`,
            noTargets: true,
          },
        ],
      };
    }

    const targetsArray = Object.values(roleTargets);
    // console.log("STEP 2 - TARGETS ARRAY:", targetsArray);

    console.log(
      `[executeSkillAction] executionIndex set to ${context.executionIndex} for skill ${skill.name}`,
    );

    const skillResults = this.performSkillExecution(
      user,
      skill,
      targetsArray,
      context,
      action,
    );

    this.processImmediateChampionMutations(context);

    // Captura snapshot intermediário AGORA, antes da próxima ação mutar os champions

    context._intermediateSnapshot = snapshotChampions(
      this.combat.activeChampions,
    );

    return {
      executed: true,
      user,
      skill,
      context,
      action,
      results: skillResults,
      repeatActionRequest: context.repeatActionRequest || null,
    };
  }

  // ============================================================
  //  MUTAÇÕES IMEDIATAS DE CAMPEÃO
  // ============================================================

  processImmediateChampionMutations(context) {
    const requests = context?.flags?.championMutationRequests;
    if (!Array.isArray(requests) || requests.length === 0) return;

    const deferredRequests = [];

    for (const request of requests) {
      if (!request || typeof request !== "object") continue;

      const shouldApplyImmediately =
        request.timing !== "postTurn" &&
        ["transform", "swap", "restore"].includes(request.mode);

      if (!shouldApplyImmediately) {
        deferredRequests.push(request);
        continue;
      }

      if (!this.mutationHandler) {
        deferredRequests.push(request);
        continue;
      }

      this.mutationHandler(request, { context, timing: "immediate" });
    }

    context.flags.championMutationRequests = deferredRequests;
  }

  // ============================================================
  //  VALIDAÇÃO DE AÇÃO (hooks podem negar)
  // ============================================================

  canExecuteAction(user, action) {
    if (!user || !user.alive) return { denied: true };

    for (const champ of this.combat.activeChampions.values()) {
      console.log(
        "[actionExecution - DEBUG]",
        champ.name,
        champ.runtime.hookEffects,
      );
    }

    console.log(
      "[canExecuteAction] Validating action for",
      user.name,
      "hooks effects:",
      user.runtime?.hookEffects?.map((e) => e.key),
    );

    // Descobrir o alvo principal da ação (primeiro alvo válido)
    let mainTarget = null;
    if (action?.targetIds) {
      for (const targetId of Object.values(action.targetIds)) {
        const target = this.combat.activeChampions.get(targetId);
        if (target && target.alive) {
          mainTarget = target;
          break;
        }
      }
    }

    const results = emitCombatEvent(
      "onValidateAction",
      {
        actionSource: user,
        skill: action?.skill,
        target: mainTarget,
      },
      this.combat.activeChampions,
    );

    for (const res of results) {
      if (res?.deny) {
        return {
          denied: true,
          message:
            res.message ||
            res.log ||
            `${formatChampionName(user)} não pode agir.`,
        };
      }
    }

    return { denied: false };
  }

  // ============================================================
  //  REEMBOLSO DE RECURSO
  // ============================================================

  refundActionResource(user, action) {
    if (!user || !action) return;
    const amount = Number(action.ultCost) || 0;
    if (amount > 0) {
      user.addUlt({ amount });
    }
  }

  // ============================================================
  //  EXECUÇÃO DE HABILIDADE
  // ============================================================

  performSkillExecution(user, skill, targets, context, action = null) {
    context.currentSkill = skill;
    // Verificar executionIndex:
    console.log(
      `[performSkillExecution] executionIndex: ${context.executionIndex}`,
    );

    // 🔹 2. Injetar contexto nos campeões
    this.combat.activeChampions.forEach((champion) => {
      champion.runtime = champion.runtime || {};
      champion.runtime.currentContext = context;
    });

    if (!Array.isArray(targets)) {
      throw new Error(
        `[SKILL ERROR] ${skill.name} recebeu targets que não são array`,
      );
    }

    if (targets.length === 0) {
      throw new Error(`[SKILL ERROR] ${skill.name} recebeu targets vazio`);
    }

    for (const t of targets) {
      if (!t || typeof t !== "object" || !t.id) {
        throw new Error(`[SKILL ERROR] ${skill.name} recebeu target inválido`);
      }
    }

    // 🔹 3. Executar skill - Passa o resolver (this) desacoplado do contexto
    const result = skill.resolve({
      user,
      targets,
      context,
      resolver: this,
    });

    // 🔹 4. Limpar contexto
    this.combat.activeChampions.forEach((champion) => {
      if (champion.runtime) delete champion.runtime.currentContext;
    });

    // 🔹 5. Registrar no histórico do turno
    this.registerSkillUsageInTurn(user, skill, targets);

    // 🔹 6. Normalizar resultado
    const results = Array.isArray(result) ? result : result ? [result] : [];

    this.applyUltMeterFromContext({ user, context });

    // 🔹 7. Hook onActionResolved
    emitCombatEvent(
      "onActionResolved",
      {
        actionSource: user,
        targets,
        skill,
        action,
        context,
      },
      this.combat.activeChampions,
    );

    return results;
  }

  // ============================================================
  //  REGISTRO DE USO DE HABILIDADE NO TURNO
  // ============================================================

  registerSkillUsageInTurn(user, skill, targets) {
    this.match.logTurnEvent("skillUsed", {
      championId: user.id,
      championName: user.name,
      skillKey: skill.key,
      skillName: skill.name,
      targetIds: Object.fromEntries(
        Object.entries(targets).map(([k, v]) => [k, v.id]),
      ),
      targetNames: Object.fromEntries(
        Object.entries(targets).map(([k, v]) => [k, v.name]),
      ),
    });

    const turnData = this.match.ensureTurnEntry();

    if (!turnData.skillsUsedThisTurn[user.id]) {
      turnData.skillsUsedThisTurn[user.id] = [];
    }

    turnData.skillsUsedThisTurn[user.id].push(skill.key);
  }

  // ============================================================
  //  APLICAÇÃO DE ULTÔMETRO PÓS-AÇÃO
  // ============================================================

  applyUltMeterFromContext({ user, context }) {
    const damageEvents = context.visual.damageEvents || [];

    // 🔹 GANHO DO USUÁRIO
    if (damageEvents.length) {
      const regenAmount = context.currentSkill?.isUltimate ? 1 : 3;
      this.applyResourceChange({
        target: user,
        amount: regenAmount,
        context,
        sourceId: user.id,
      });
    }

    // 🔹 GANHO DE QUEM SOFREU DANO
    const damagedTargets = new Set();

    for (const event of damageEvents) {
      if (!event.targetId || event.amount <= 0) continue;
      damagedTargets.add(event.targetId);
    }

    for (const targetId of damagedTargets) {
      const target = this.combat.activeChampions.get(targetId);
      if (!target || !target.alive) continue;

      this.applyResourceChange({
        target,
        amount: 1,
        context,
        sourceId: user?.id,
      });
    }
  }

  /**
   * Ponto único de entrada (Backend) para mudança de recursos com emissão de hooks.
   * Orquestra: Mudança de Estado (Champion) -> Visual (Context) -> Gameplay Hooks (Emitter).
   */
  applyResourceChange({ target, amount, context, sourceId }) {
    if (!target || amount === 0) return 0;

    // 1. Backend State Change (Champion)
    const applied =
      amount > 0 ? target.addUlt(amount) : target.spendUlt(amount);

    if (applied === 0) return 0;

    const eventType = applied > 0 ? "onResourceGain" : "onResourceSpend";
    const payloadType = applied > 0 ? "resourceGain" : "resourceSpend";

    // 2. Frontend Visual Registration (Context)
    context.registerResourceChange({ target, amount: applied, sourceId });

    // 3. Backend Gameplay Logic (Hooks)
    emitCombatEvent(
      eventType,
      {
        target,
        amount: Math.abs(applied),
        context,
        type: payloadType,
        resourceType: "ult",
        source: this.combat.activeChampions.get(sourceId) || null,
        resolver: this, // Desacoplado do contexto, passado como bridge
      },
      this.combat.activeChampions,
    );

    return applied;
  }

  // ============================================================
  // ============================================================
  //  RESOLUÇÃO DE ALVOS
  // ============================================================

  resolveSkillTargets(user, skill, action, context) {
    context ??= this.createBaseContext({ sourceId: action?.userId });

    const isUnavailable = (c) => !c || !c.alive;

    const targets =
      this._resolveTauntTargets(user, skill, action, context, isUnavailable) ??
      this._resolveAoETargets(user, skill, isUnavailable) ??
      this._resolveDirectTargets(user, action, isUnavailable);

    return targets && Object.keys(targets).length > 0 ? targets : null;
  }

  _resolveTauntTargets(user, skill, action, context, isUnavailable) {
    const activeTaunt = user.tauntEffects?.find(
      (e) => e.expiresAtTurn > this.combat.currentTurn,
    );

    if (
      !activeTaunt ||
      !action?.targetIds ||
      Object.keys(action.targetIds).length === 0
    )
      return null;
    if (!Array.isArray(skill.targetSpec)) return null;

    const taunter = this.combat.activeChampions.get(activeTaunt.taunterId);
    if (isUnavailable(taunter)) return null;

    const targets = {};
    const redirectionEvents = [];
    let redirected = false;

    skill.targetSpec.forEach((spec, index) => {
      const type = typeof spec === "string" ? spec : spec.type;
      if (type !== "enemy") return;

      const roleKey = index === 0 ? "enemy" : `enemy${index + 1}`;
      const originalId = action.targetIds?.[roleKey];
      if (!originalId) return;

      const original = this.combat.activeChampions.get(originalId);
      if (isUnavailable(original)) return;
      if (spec.unique === true) return;

      targets[roleKey] = taunter;
      redirected = true;
      redirectionEvents.push({
        type: "tauntRedirection",
        attackerId: user.id,
        fromTargetId: original.id,
        toTargetId: taunter.id,
      });
    });

    if (!redirected) return null;

    // Preencher roles não redirecionados com os alvos originais
    for (const role in action.targetIds) {
      if (!targets[role]) {
        const target = this.combat.activeChampions.get(action.targetIds[role]);
        if (!isUnavailable(target)) targets[role] = target;
      }
    }

    context.visual.redirectionEvents = context.visual.redirectionEvents || [];
    context.visual.redirectionEvents.push(...redirectionEvents);

    return targets;
  }

  _resolveAoETargets(user, skill, isUnavailable) {
    const normalizedSpec = Array.isArray(skill.targetSpec)
      ? skill.targetSpec.map((s) => (typeof s === "string" ? s : s.type))
      : [];

    const hasAll = normalizedSpec.includes("all");
    const hasAllEnemies =
      normalizedSpec.includes("all-enemies") ||
      normalizedSpec.includes("all:enemy");
    const hasAllAllies =
      normalizedSpec.includes("all-allies") ||
      normalizedSpec.includes("all:ally");

    if (!hasAll && !hasAllEnemies && !hasAllAllies) return null;

    const targets = {};

    if (hasAllEnemies || hasAll) {
      Array.from(this.combat.activeChampions.values())
        .filter((c) => c.team !== user.team && !isUnavailable(c))
        .forEach((enemy, i) => {
          targets[i === 0 ? "enemy" : `enemy${i + 1}`] = enemy;
        });
    }

    if (hasAllAllies || hasAll) {
      Array.from(this.combat.activeChampions.values())
        .filter((c) => c.team === user.team && !isUnavailable(c))
        .forEach((ally, i) => {
          targets[i === 0 ? "ally" : `ally${i + 1}`] = ally;
        });
    }

    return targets;
  }

  _resolveDirectTargets(user, action, isUnavailable) {
    if (!action?.targetIds) return null;

    const targets = {};
    for (const role in action.targetIds) {
      const target = this.combat.activeChampions.get(action.targetIds[role]);
      if (!isUnavailable(target)) {
        targets[role] = target;
      } else if (role === "self") {
        targets[role] = user;
      }
    }
    return targets;
  }

  // ============================================================
  //  CRIAÇÃO DE CONTEXTO BASE
  // ============================================================

  createBaseContext({ sourceId = null } = {}) {
    const aliveChampionsArray = [
      ...this.combat.activeChampions.values(),
    ].filter((c) => c.alive);

    const combat = this.combat;
    const editMode = this.editMode;

    return {
      currentTurn: combat.currentTurn,
      editMode,
      allChampions: combat.activeChampions,
      aliveChampions: aliveChampionsArray,
      // eventIndex: 0, // para controle interno de ordem de eventos dentro da resolução de uma ação

      // ========================
      // EVENT BUFFERS
      // ========================
      visual: {
        damageEvents: [],
        healEvents: [],
        buffEvents: [],
        resourceEvents: [],
        shieldEvents: [],
        redirectionEvents: [],
        // fallback (mantém compatibilidade)
        globalDialogs: [],
      },

      _lastEventRef: null, // referência para o último evento registrado, útil para diálogos que precisam se referir a ele

      repeatActionRequest: null,
      flags: {},

      healSourceId: sourceId,
      statModifierSrcId: sourceId,

      requestChampionMutation(request) {
        if (!request || typeof request !== "object") return null;

        this.flags.championMutationRequests ??= [];
        this.flags.championMutationRequests.push(request);

        return request;
      },

      schedule(scheduledEffect) {
        combat.scheduledEffects.push(scheduledEffect);
      },

      getTeamLine(team, options = {}) {
        return combat.getTeamLine(team, options);
      },

      getAdjacentChampions(target, { side } = {}) {
        return combat.getAdjacentChampions(target, { side });
      },

      // nextEventIndex() {
      //   return this.eventIndex++;
      // },

      // ========================
      // REGISTRIES
      // ========================
      // -- DAMAGE REGISTRY -- //
      registerDamage({
        target,
        amount,
        sourceId,
        isCritical = false,
        damageDepth = 0,
        isDot = false,
        flags,
      } = {}) {
        if (!target?.id) return;

        this._lastEventRef = null;

        const finishingType =
          flags?.finishingType ??
          (flags?.isObliterate
            ? "obliterate"
            : flags?.isFinishing
              ? "generic"
              : null);

        const isFinishing = !!finishingType;
        const isObliterate = finishingType === "obliterate";

        const event = {
          // eventIndex: this.nextEventIndex(),
          type: "damage",
          sourceId: sourceId || null,
          targetId: target.id,
          amount,
          isCritical: !!isCritical,
          isDot: !!isDot,
          damageDepth: damageDepth || 0,
          evaded: flags?.evaded,
          immune: !!flags?.immune,
          immuneMessage: flags?.immuneMessage ?? null,
          shieldBlocked: !!flags?.shieldBlocked,
          obliterate: isObliterate,
          finishing: isFinishing,
          finishingType,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.damageEvents.push(event);
        this._lastEventRef = event; // referência para possível uso em diálogos relacionados a esse dano
      },

      // -- HEAL REGISTRY -- //
      registerHeal({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        const sourceChamp =
          combat.activeChampions.get(sourceId) ||
          combat.activeChampions.get(this.healSourceId) ||
          target;

        this._lastEventRef = null;

        const event = {
          type: "heal",
          targetId: target.id,
          sourceId: sourceChamp?.id || target.id,
          amount: value,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.healEvents.push(event);
        this._lastEventRef = event; // referência para possível uso em diálogos relacionados a essa cura

        // 🔥 Dispara hook de cura
        emitCombatEvent(
          "onAfterHealing",
          {
            healSrc: sourceChamp || null,
            healTarget: target,
            amount: value,
            context: this,
          },
          this.allChampions,
        );
      },

      // -- BUFF REGISTRY -- //
      registerBuff({ target, amount, statName, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value === 0) return;

        const sourceChamp =
          combat.activeChampions.get(sourceId) ||
          combat.activeChampions.get(this.statModifierSrcId) ||
          target;

        this._lastEventRef = null;

        // Mantém comportamento anterior de UI/ult: apenas ganhos positivos entram em buffEvents
        if (value > 0) {
          const event = {
            // eventIndex: this.nextEventIndex(),
            type: "buff",
            targetId: target.id,
            sourceId: sourceChamp?.id || target.id,
            amount: value,
            statName,
            preDialogs: [],
            postDialogs: [],
          };

          this.visual.buffEvents.push(event);
          this._lastEventRef = event;
        } else {
          this._lastEventRef = null; // mudanças negativas não geram evento visual, então limpa a referência para evitar associações incorretas em diálogos
        }

        emitCombatEvent(
          "onBuffingStat",
          {
            buffSrc: sourceChamp || null,
            buffTarget: target,
            statName,
            amount: value,
            context: this,
          },
          this.allChampions,
        );
      },

      // -- SHIELD REGISTRY -- //
      registerShield({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        this._lastEventRef = null;

        const event = {
          type: "shield",
          targetId: target.id,
          sourceId: sourceId || this.healSourceId || target.id,
          amount: value,
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.shieldEvents.push(event);
        this._lastEventRef = event;
      },
      // -- RESOURCE REGISTRY (Visual Only) -- //
      registerResourceChange({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value === 0) return 0;

        const eventType = value > 0 ? "resourceGain" : "resourceSpend";

        const event = {
          type: eventType,
          targetId: target.id,
          sourceId: sourceId || this.healSourceId || target.id,
          amount: Math.abs(value),
          resourceType: "ult",
          preDialogs: [],
          postDialogs: [],
        };

        this.visual.resourceEvents.push(event);
        this._lastEventRef = event;

        return value;
      },

      // -- ULT GAIN REGISTRY (Visual Only) -- //
      registerUltGain({ target, amount, sourceId } = {}) {
        return this.registerResourceChange({ target, amount, sourceId });
      },
      // -- DIALOG REGISTRY -- //
      registerDialog({
        message,
        timing = "pre",
        sourceId = null,
        targetId = null,
        duration = null,
      } = {}) {
        if (!message) return;

        const dialogObj = {
          message,
          sourceId,
          targetId,
          duration,
        };

        if (this._lastEventRef) {
          const key = timing === "post" ? "postDialogs" : "preDialogs";

          this._lastEventRef[key] ??= []; // 🔥 garante array
          this._lastEventRef[key].push(dialogObj);
        } else {
          // fallback global
          this.visual.globalDialogs ??= [];
          this.visual.globalDialogs.push(dialogObj);
        }
      },
    };
  }
}
