import { formatChampionName } from "../../ui/formatters.js";
import { emitCombatEvent } from "./combatEvents.js";
import { snapshotChampions } from "./snapshotChampions.js";

export class TurnResolver {
  constructor(match, editMode) {
    this.match = match;
    this.combat = match.combat;
    this.editMode = editMode ?? {};
  }

  // ============================================================
  //  RESOLUÇÃO DO TURNO (entry point)
  // ============================================================

  resolveTurn() {
    const actionResults = [];
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

      // 🔹 registra a posição da execução
      action.executionIndex = actionOrder++;

      const user = this.combat.activeChampions.get(action.userId);

      turnExecutionMap.set(user.id, action.executionIndex);

      const result = this.executeSkillAction(action, turnExecutionMap);
      actionResults.push(result);
    }

    const deathResults = this.processChampionDeaths();

    return { actionResults, deathResults };
  }

  // ============================================================
  //  PROCESSAMENTO DE MORTES
  // ============================================================

  processChampionDeaths(maxScore = 3) {
    const results = [];
    for (const champ of this.combat.activeChampions.values()) {
      if (!champ.alive) {
        const result = this.match.removeChampionFromGame(champ.id, maxScore);
        if (result) results.push(result);
      }
    }
    return results;
  }

  // ============================================================
  //  EXECUÇÃO DE AÇÃO INDIVIDUAL
  // ============================================================

  executeSkillAction(action, turnExecutionMap) {
    // console.log("[EXECUTE SKILL ACTION] [TARGETS]", action);
    const user = this.combat.activeChampions.get(action.userId);

    if (!user || !user.alive) {
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

    const context = this.createBaseContext({ sourceId: user.id });

    const roleTargets = this.resolveSkillTargets(user, skill, action, context);

    // console.log("STEP 1 - TARGETS:", roleTargets);
    if (!roleTargets) {
      this.refundActionResource(user, action);
      return { executed: false, reason: "no_targets", user, action };
    }

    const targetsArray = Object.values(roleTargets);
    // console.log("STEP 2 - TARGETS ARRAY:", targetsArray);

    context.executionIndex = action.executionIndex;
    console.log(
      `[executeSkillAction] executionIndex set to ${context.executionIndex} for skill ${skill.name}`,
    );

    context.turnExecutionMap = turnExecutionMap;

    this.performSkillExecution(user, skill, targetsArray, context);

    // Captura snapshot intermediário AGORA, antes da próxima ação mutar os champions

    context._intermediateSnapshot = snapshotChampions(this.combat.activeChampions);

    return { executed: true, user, skill, context, action };
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

    const results = emitCombatEvent(
      "onValidateAction",
      {
        source: user,
        skill: action?.skill,
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
      user.addUlt(amount);
    }
  }

  // ============================================================
  //  EXECUÇÃO DE HABILIDADE
  // ============================================================

  performSkillExecution(user, skill, targets, context) {
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

    // 🔹 3. Executar skill
    const result = skill.resolve({
      user,
      targets,
      context,
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

    for (const r of results) {
      if (r?.extraEffects?.some((e) => e.type === "dialog")) {
        /* console.log(
          "🔵 SERVER → dialog recebido do processDamageEvent:",
          r.extraEffects,
        );
        */
      }
    }

    // 🔹 7. Hook onActionResolved
    emitCombatEvent(
      "onActionResolved",
      {
        source: user,
        targets,
        skill,
        context,
      },
      this.combat.activeChampions,
    );
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
    const healEvents = context.visual.healEvents || [];
    const buffEvents = context.visual.buffEvents || [];

    // 🔹 GANHO DO USUÁRIO
    if (damageEvents.length > 0) {
      const regenAmount = context.currentSkill?.isUltimate ? 1 : 3;
      const applied = user.addUlt({ amount: regenAmount, context });
      // console.log("[ULT - DEALER]", user.name, applied);
    } else if (healEvents.length > 0) {
      const applied = user.addUlt({ amount: 1, context });
      // console.log("[ULT - HEAL]", user.name, applied);
    } else if (buffEvents.length > 0) {
      const applied = user.addUlt({ amount: 1, context });
      // console.log("[ULT - BUFF]", user.name, applied);
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

      const applied = target.addUlt({ amount: 1, context });
      // console.log("[ULT - TAKEN]", target.name, applied);
    }
  }

  // ============================================================
  //  RESOLUÇÃO DE ALVOS
  // ============================================================

  resolveSkillTargets(user, skill, action, context) {
    const currentTargets = {};
    let redirected = false;

    // console.log("==== RESOLVE START ====");
    // console.log("Skill:", skill.key);
    // console.log("Incoming targetIds:", action.targetIds);
    // console.log("TauntEffects:", user.tauntEffects);

    context ??= this.createBaseContext({ sourceId: action?.userId });

    // =========================
    // TAUNT
    // =========================

    const activeTaunt = user.tauntEffects?.find(
      (effect) => effect.expiresAtTurn > this.combat.currentTurn,
    );

    const hasTaunt = !!activeTaunt;

    const canRedirect =
      hasTaunt && action?.targetIds && Object.keys(action.targetIds).length > 0;

    // =========================
    // REDIRECTION
    // =========================

    if (canRedirect && Array.isArray(skill.targetSpec)) {
      const taunter = this.combat.activeChampions.get(activeTaunt.taunterId);

      if (taunter && taunter.alive) {
        let redirectionEvents = [];

        skill.targetSpec.forEach((spec, index) => {
          const type = typeof spec === "string" ? spec : spec.type;

          if (type !== "enemy") return;

          const roleKey = index === 0 ? "enemy" : `enemy${index + 1}`;

          const originalId = action.targetIds?.[roleKey];

          if (!originalId) return;

          const original = this.combat.activeChampions.get(originalId);
          if (!original || !original.alive) return;

          if (spec.unique === true) return;

          currentTargets[roleKey] = taunter;
          redirected = true;

          redirectionEvents.push({
            type: "tauntRedirection",
            attackerId: user.id,
            fromTargetId: original.id,
            toTargetId: taunter.id,
          });
        });

        // Preencher demais roles não redirecionados
        for (const role in action.targetIds) {
          if (!currentTargets[role]) {
            const target = this.combat.activeChampions.get(
              action.targetIds[role],
            );
            if (target && target.alive) {
              currentTargets[role] = target;
            }
          }
        }

        if (redirected) {
          context.visual.redirectionEvents =
            context.visual.redirectionEvents || [];

          context.visual.redirectionEvents.push(...redirectionEvents);

          /* console.log(
            `${formatChampionName(user)} foi provocado e redirecionou seu ataque para ${formatChampionName(taunter)}!`,
          );
          */
        }
      }
    }

    // =========================
    // NORMAL RESOLUTION (if nothing redirected)
    // =========================

    if (!redirected) {
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

      if (hasAllEnemies || hasAllAllies || hasAll) {
        if (hasAllEnemies || hasAll) {
          const enemies = Array.from(
            this.combat.activeChampions.values(),
          ).filter((c) => c.team !== user.team && c.alive);

          enemies.forEach((enemy, i) => {
            const key = i === 0 ? "enemy" : `enemy${i + 1}`;
            currentTargets[key] = enemy;
          });
        }

        if (hasAllAllies || hasAll) {
          const allies = Array.from(
            this.combat.activeChampions.values(),
          ).filter((c) => c.team === user.team && c.alive);

          allies.forEach((ally, i) => {
            const key = i === 0 ? "ally" : `ally${i + 1}`;
            currentTargets[key] = ally;
          });
        }
      } else if (action?.targetIds) {
        for (const role in action.targetIds) {
          const target = this.combat.activeChampions.get(
            action.targetIds[role],
          );

          if (target && target.alive) {
            currentTargets[role] = target;
          } else if (role === "self") {
            currentTargets[role] = user;
          }
        }
      }
    }

    if (Object.keys(currentTargets).length === 0) {
      /* console.log(
        `Nenhum alvo válido para a ação de ${formatChampionName(user)}. Ação cancelada.`,
      );
      */
      return null;
    }

    return currentTargets;
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
        dialogEvents: [],
        redirectionEvents: [],
      },

      healSourceId: sourceId,
      buffSourceId: sourceId,

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

        this.visual.damageEvents.push({
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
          shieldBlocked: !!flags?.shieldBlocked,
          obliterate: !!flags?.isObliterate,
        });
      },
      // -- HEAL REGISTRY -- //
      registerHeal({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        const sourceChamp =
          combat.activeChampions.get(sourceId) ||
          combat.activeChampions.get(this.healSourceId) ||
          target;

        this.visual.healEvents.push({
          // eventIndex: this.nextEventIndex(),
          type: "heal",
          targetId: target.id,
          sourceId: sourceChamp?.id || target.id,
          amount: value,
        });
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

        this.visual.buffEvents.push({
          // eventIndex: this.nextEventIndex(),
          type: "buff",
          targetId: target.id,
          sourceId: sourceId || this.buffSourceId || target.id,
          amount: value,
          statName,
        });
      },
      // -- SHIELD REGISTRY -- //
      registerShield({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return;

        this.visual.shieldEvents.push({
          // eventIndex: this.nextEventIndex(),
          type: "shield",
          targetId: target.id,
          sourceId: sourceId || this.healSourceId || target.id,
          amount: value,
        });
      },
      // -- RESOURCE REGISTRY -- //
      registerResourceChange({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value === 0) return 0;

        let applied = 0;

        if (value > 0) {
          applied = target.addUlt({
            amount: value,
            source: combat.activeChampions.get(sourceId) || target,
            context: this,
          });
        } else {
          const spend = Math.abs(value);
          if (!target.spendUlt(spend)) return 0;
          applied = -spend;
        }

        if (applied === 0) return 0;

        const eventType = applied > 0 ? "resourceGain" : "resourceSpend";

        this.visual.resourceEvents.push({
          // eventIndex: this.nextEventIndex(),
          type: eventType,
          targetId: target.id,
          sourceId: sourceId || this.healSourceId || target.id,
          amount: Math.abs(applied),
          resourceType: "ult",
        });

        // 🔥 Agora dispara hook corretamente
        emitCombatEvent(
          applied > 0 ? "onResourceGain" : "onResourceSpend",
          {
            target: target,
            amount: Math.abs(applied),
            context: this,
            type: eventType,
            resourceType: "ult",
            source: combat.activeChampions.get(sourceId) || null,
          },
          this.allChampions,
        );

        return applied;
      },
      // -- ULT GAIN REGISTRY -- //
      registerUltGain({ target, amount, sourceId } = {}) {
        const value = Number(amount) || 0;
        if (!target?.id || value <= 0) return 0;

        const applied = amount ?? 0;
        if (applied > 0) {
          this.visual.resourceEvents.push({
            // eventIndex: this.nextEventIndex(),
            type: "resourceGain",
            targetId: target.id,
            sourceId: sourceId || target.id,
            amount: applied,
          });
        }

        return applied;
      },
      // -- DIALOG REGISTRY -- //
      registerDialog({
        message,
        blocking = true,
        sourceId = null,
        targetId = null,
        damageDepth,
      } = {}) {
        if (!message) return;

        this.visual.dialogEvents.push({
          // eventIndex: this.nextEventIndex(),
          type: "dialog",
          message,
          blocking,
          sourceId: sourceId || null,
          targetId: targetId || null,
          damageDepth: damageDepth ?? this.damageDepth ?? 0,
        });
      },
    };
  }
}
