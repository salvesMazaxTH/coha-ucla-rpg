// ============================================================
//  HELPERS DE MANIPULAÇÃO DE ULTÔMETRO
// ============================================================
/**
 * Aplica regeneração global de ultMeter (+3 unidades por turno)
 */
function applyGlobalTurnRegen(champion, context) {
  if (!champion || !champion.alive) return 0;

  const GLOBAL_ULT_REGEN = 3; // +3 unidades por turno (conforme spec)

  const applied = champion.addUlt({
    amount: GLOBAL_ULT_REGEN,
    context,
  });

  console.log(
    ` ${champion.name} regenerou ${applied} de ult no início do turno. Ult atual: ${champion.ultMeter}/${champion.ultCap}`,
  );

  return applied;
}

/**
 * Reembolso de ultMeter (ex: ação negada)
 */
function refundActionResource(user, action) {
  if (!user || !action) return;
  const amount = Number(action.resourceCost) || 0;
  if (amount > 0) {
    user.addUlt(amount);
  }
}

/**
 * Aplica ganho de ultMeter baseado no contexto de um evento de combate.
 */
function applyUltMeterFromContext({ user, context }) {
  const damageEvents = context.visual.damageEvents || [];
  const healEvents = context.visual.healEvents || [];
  const buffEvents = context.visual.buffEvents || [];

  // =========================
  // 🔹 GANHO DO USUÁRIO
  // =========================

  if (damageEvents.length > 0) {
    const regenAmount = context.currentSkill?.isUltimate ? 1 : 3;
    const applied = user.addUlt({ amount: regenAmount, context });

    console.log("[ULT - DEALER]", user.name, applied);
  } else if (healEvents.length > 0) {
    const applied = user.addUlt({ amount: 1, context });
    console.log("[ULT - HEAL]", user.name, applied);
  } else if (buffEvents.length > 0) {
    const applied = user.addUlt({ amount: 1, context });
    console.log("[ULT - BUFF]", user.name, applied);
  }

  // =========================
  // 🔹 GANHO DE QUEM SOFREU DANO
  // =========================

  const damagedTargets = new Set();

  for (const event of damageEvents) {
    if (!event.targetId || event.amount <= 0) continue;
    damagedTargets.add(event.targetId);
  }

  for (const targetId of damagedTargets) {
    const target = match.combat.activeChampions.get(targetId);
    if (!target || !target.alive) continue;

    const applied = target.addUlt({ amount: 1, context });

    console.log("[ULT - TAKEN]", target.name, applied);
  }
}

// ============================================================
//  IMPORTS
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path, { format } from "path";
import { fileURLToPath } from "url";

import { GameMatch } from "../shared/engine/match/gameMatch.js";
import { Player } from "../shared/engine/match/Player.js";

import { championDB } from "../shared/data/championDB.js";
import { Champion } from "../shared/core/Champion.js";
import { generateId } from "../shared/utils/id.js";
import {
  formatChampionName,
  formatPlayerName,
} from "../shared/ui/formatters.js";
import { emitCombatEvent } from "../shared/engine/combat/combatEvents.js";

// ============================================================
//  CONFIGURAÇÃO
// ============================================================

const editMode = {
  enabled: true,
  autoLogin: true,
  autoSelection: false,
  actMultipleTimesPerTurn: false,
  unavailableChampions: true,
  damageOutput: null, // Valor fixo de dano para testes (ex: 999). null = desativado. (SERVER-ONLY)
  alwaysCrit: true, // Força crítico em todo ataque. (SERVER-ONLY)
  alwaysEvade: false, // Força evasão em todo ataque. (SERVER-ONLY)
  executionOverride: null, // null = normal
  // number = força threshold (ex: 1 = 100%, 0.5 = 50%)
  freeCostSkills: true, // Habilidades não consomem recurso. (SERVER-ONLY)
};

const TEAM_SIZE = 3;
const MAX_SCORE = 3; // primeiro a derrotar 3 campeões inimigos
const CHAMPION_SELECTION_TIME = 120; // Segundos para seleção de campeões
const DISCONNECT_TIMEOUT = 30 * 1000; // 30 s para reconexão

// ============================================================
//  SERVIDOR HTTP & EXPRESS
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/shared", express.static(path.join(__dirname, "..", "shared")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ============================================================
//  ESTADO DO JOGO
// ============================================================

const match = new GameMatch();

/** Garante que a entrada do turno atual existe no histórico. */
function ensureTurnEntry() {
  return match.ensureTurnEntry();
}

/** Registra um evento no histórico do turno atual. */
function logTurnEvent(eventType, eventData) {
  match.logTurnEvent(eventType, eventData);
}

// ============================================================
//  SERIALIZAÇÃO DO ESTADO
// ============================================================

function getGameState() {
  return {
    champions: Array.from(match.combat.activeChampions.values()).map((c) =>
      c.serialize(),
    ),
    currentTurn: match.combat.currentTurn,
  };
}

// ============================================================
//  GERENCIAMENTO DE CAMPEÕES
// ============================================================

/** Retorna uma chave aleatória de campeão, excluindo as fornecidas. */
function getRandomChampionKey(excludeKeys = []) {
  const availableKeys = Object.keys(championDB).filter((key) => {
    if (excludeKeys.includes(key)) return false;
    if (championDB[key]?.unreleased === true && !editMode.unreleasedChampions)
      return false;
    return true;
  });
  if (availableKeys.length === 0) return null;
  return availableKeys[Math.floor(Math.random() * availableKeys.length)];
}

/** Instancia e registra campeões de uma lista de keys em um time. */
function assignChampionsToTeam(team, championKeys) {
  championKeys.forEach((championKey) => {
    if (!championKey) return;

    const baseData = championDB[championKey];
    if (!baseData) return;

    const id = generateId(championKey);

    const newChampion = Champion.fromBaseData(baseData, id, team);

    match.combat.registerChampion(newChampion, { trackSnapshot: false });

    // 👇 registrar snapshot correto
    match.combat.combatSnapshot.push({
      championKey,
      id,
      team,
    });
  });
}

/** Verifica se ambos os jogadores selecionaram seus times e notifica os clientes. */
function checkAllTeamsSelected() {
  if (match.isTeamSelected(0) && match.isTeamSelected(1)) {
    io.emit("allTeamsSelected");
    io.emit("gameStateUpdate", getGameState());
    return true;
  }
  return false;
}

// --- Animação de morte: atraso para o client reproduzir a animação ---
const CLIENT_DEATH_ANIMATION_DURATION = 2000;
const SERVER_DELAY_AFTER_ANIMATION = 500;

/** Remove um campeão do jogo, atualiza placar e traz reserva se necessário. */
function removeChampionFromGame(championId, playerTeam) {
  const championToRemove = match.combat.activeChampions.get(championId);
  if (!championToRemove) {
    console.error(`[Server] Campeão ${championId} não encontrado.`);
    return;
  }

  // Registra morte no histórico
  logTurnEvent("championDied", {
    championId,
    championName: championToRemove.name,
    team: championToRemove.team,
  });
  ensureTurnEntry().championsDeadThisTurn.push(championId);

  // Atualiza placar
  const scoringTeam = championToRemove.team === 1 ? 2 : 1;
  const scoringPlayerSlot = scoringTeam - 1;

  if (!match.isGameEnded()) {
    match.addPointForSlot(scoringPlayerSlot, MAX_SCORE);
    io.emit("scoreUpdate", match.getScorePayload());

    io.emit(
      "combatLog",
      `${formatPlayerName(match.players[scoringPlayerSlot]?.username, scoringTeam)} marcou um ponto!`,
    );
  }

  match.combat.removeChampion(championId);
  io.emit("championRemoved", championId);

  io.emit("gameStateUpdate", getGameState());
}

// ============================================================
//  VALIDAÇÃO DE AÇÕES (pré-resolução)
// ============================================================

/**
 * Valida se o campeão pode SOLICITAR o uso de uma habilidade.
 * Chamada em "requestSkillUse" — rejeita imediatamente via socket.
 */
function validateActionIntent(user, skill, socket) {
  console.log("[VALIDATE ACTION CALLED]", user?.name);
  if (!user.alive) {
    socket.emit("skillDenied", "Campeão morto.");
    return false;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    socket.emit("skillDenied", "Já agiu neste turno.");
    return false;
  }

  console.log(
    "[VALIDATE ACTION] [HOOK EFFECTS DO USER]",
    user.runtime?.hookEffects?.map((e) => e.key),
  );

  const results = emitCombatEvent(
    "onValidateAction",
    { source: user, skill },
    match.combat.activeChampions,
  );

  console.log("[VALIDATE ACTION] Results from onValidateAction:", results);

  for (const res of results) {
    console.log("[VALIDATE ACTION RESULT]", res);
    if (res?.message) {
      socket.emit("skillDenied", res.message);
      console.log(`[VALIDATE ACTION] Action denied: ${res.message}`);
    }

    if (res?.deny) {
      console.log(`[VALIDATE ACTION] Action explicitly denied by a hook.`);
      return false;
    }
  }

  return true;
}

/**
 * Valida se o campeão pode EXECUTAR a ação no momento da resolução do turno.
 * Diferente de validateActionIntent — aqui o estado pode ter mudado.
 */
function canExecuteAction(user, action) {
  if (!user || !user.alive) return false;

  for (const champ of match.combat.activeChampions.values()) {
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
    match.combat.activeChampions,
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
//  RESOLUÇÃO DE ALVOS
// ============================================================

/** Resolve os alvos de uma ação, respeitando Taunt e validando existência. */
function resolveSkillTargets(user, skill, action, context) {
  const currentTargets = {};
  let redirected = false;

  console.log("==== RESOLVE START ====");
  console.log("Skill:", skill.key);
  console.log("Incoming targetIds:", action.targetIds);
  console.log("TauntEffects:", user.tauntEffects);

  // Antecipar contexto
  context ??= createBaseContext({ sourceId: user.id });

  // =========================
  // TAUNT
  // =========================

  const activeTaunt = user.tauntEffects?.find(
    (effect) => effect.expiresAtTurn > match.combat.currentTurn,
  );

  const hasTaunt = !!activeTaunt;

  const canRedirect =
    hasTaunt && action?.targetIds && Object.keys(action.targetIds).length > 0;

  // =========================
  // REDIRECTION
  // =========================

  if (canRedirect && Array.isArray(skill.targetSpec)) {
    const taunter = match.combat.activeChampions.get(activeTaunt.taunterId);

    if (taunter && taunter.alive) {
      let redirectionEvents = [];

      skill.targetSpec.forEach((spec, index) => {
        const type = typeof spec === "string" ? spec : spec.type;

        if (type !== "enemy") return;

        const roleKey = index === 0 ? "enemy" : `enemy${index + 1}`;

        const originalId = action.targetIds?.[roleKey];

        if (!originalId) return;

        const original = match.combat.activeChampions.get(originalId);
        if (!original || !original.alive) return;

        // Se unique obrigatório → NÃO redireciona automaticamente
        if (spec.unique === true) return;

        // Redireciona
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
          const target = match.combat.activeChampions.get(
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

        io.emit(
          "combatLog",
          `${formatChampionName(user)} foi provocado e redirecionou seu ataque para ${formatChampionName(taunter)}!`,
        );
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

    const hasAllEnemies =
      normalizedSpec.includes("all-enemies") ||
      normalizedSpec.includes("all:enemy");

    const hasAllAllies =
      normalizedSpec.includes("all-allies") ||
      normalizedSpec.includes("all:ally");

    const hasAll = normalizedSpec.includes("all");

    if (hasAllEnemies || hasAllAllies || hasAll) {
      if (hasAllEnemies || hasAll) {
        const enemies = Array.from(
          match.combat.activeChampions.values(),
        ).filter((c) => c.team !== user.team && c.alive);

        enemies.forEach((enemy, i) => {
          const key = i === 0 ? "enemy" : `enemy${i + 1}`;
          currentTargets[key] = enemy;
        });
      }

      if (hasAllAllies || hasAll) {
        const allies = Array.from(match.combat.activeChampions.values()).filter(
          (c) => c.team === user.team && c.alive,
        );

        allies.forEach((ally, i) => {
          const key = i === 0 ? "ally" : `ally${i + 1}`;
          currentTargets[key] = ally;
        });
      }
    } else if (action?.targetIds) {
      for (const role in action.targetIds) {
        const target = match.combat.activeChampions.get(action.targetIds[role]);

        if (target && target.alive) {
          currentTargets[role] = target;
        } else if (role === "self") {
          currentTargets[role] = user;
        }
      }
    }
  }

  if (Object.keys(currentTargets).length === 0) {
    io.emit(
      "combatLog",
      `Nenhum alvo válido para a ação de ${formatChampionName(user)}. Ação cancelada.`,
    );
    return null;
  }

  return currentTargets;
}

// ============================================================
//  EMISSÃO DE AÇÕES DE COMBATE (v2)
// ============================================================

/**
 * Extrai efeitos visuais ordenados a partir de um resultado do CombatResolver.
 * Retorna um array de efeitos que o cliente animará sequencialmente.
 */

function buildEmitTargetInfo(realTargetIds) {
  let targetName = null;

  if (realTargetIds.length === 1) {
    const champ = match.combat.activeChampions.get(realTargetIds[0]);
    targetName = champ ? formatChampionName(champ) : null;
  } else if (realTargetIds.length > 1) {
    const names = realTargetIds.map((id) => {
      const champ = match.combat.activeChampions.get(id);
      return champ ? formatChampionName(champ) : "Desconecido";
    });

    const last = names.pop();
    targetName = `${names.join(", ")} e ${last}`;
  }

  return {
    targetId: realTargetIds[0] ?? null,
    targetName,
  };
}

function emitCombatEnvelopesFromContext({ user, skill, context }) {
  const mainEnvelope = buildMainEnvelopeFromContext({
    user,
    skill,
    context,
  });

  const reactionEnvelopes = buildReactionEnvelopesFromContext({
    user,
    skill,
    context,
  });

  if (mainEnvelope) {
    console.log(
      "SERVER SNAPSHOT ULT:",
      [...match.combat.activeChampions.values()].map((c) => ({
        name: c.name,
        ult: c.ultMeter,
      })),
    );

    const {
      damageEvents = [],
      healEvents = [],
      shieldEvents = [],
      buffEvents = [],
      resourceEvents = [],
      dialogEvents = [],
    } = mainEnvelope;

    const hasVisualChanges =
      damageEvents.length ||
      healEvents.length ||
      shieldEvents.length ||
      buffEvents.length ||
      resourceEvents.length ||
      dialogEvents.length;

    const shouldEmit = mainEnvelope.action || hasVisualChanges;

    if (shouldEmit) {
      emitCombatAction(mainEnvelope);
    }
  }

  for (const envelope of reactionEnvelopes) {
    emitCombatAction(envelope);
  }
}

function buildMainEnvelopeFromContext({ user, skill, context }) {
  const {
    damageEvents = [],
    healEvents = [],
    shieldEvents = [],
    buffEvents = [],
    resourceEvents = [],
    dialogEvents = [],
  } = context.visual || {};

  const userId = user?.id ?? null;
  const userName = user?.name ?? null;

  const mainDamage = damageEvents.filter((d) => (d.damageDepth ?? 0) === 0);
  const mainHeal = healEvents.filter((h) => (h.damageDepth ?? 0) === 0);
  const mainShield = shieldEvents.filter((s) => (s.damageDepth ?? 0) === 0);
  const mainBuff = buffEvents.filter((b) => (b.damageDepth ?? 0) === 0);
  const mainResource = resourceEvents.filter((r) => (r.damageDepth ?? 0) === 0);
  const mainDialog = dialogEvents.filter((d) => (d.damageDepth ?? 0) === 0);

  const affectedIds = new Set(
    [...mainDamage, ...mainHeal, ...mainShield, ...mainBuff, ...mainResource]
      .map((e) => e.targetId)
      .filter(Boolean),
  );

  const realTargetIds = [
    ...new Set(
      mainDamage.map((e) => e.targetId).filter((id) => id && id !== userId),
    ),
  ];

  const { targetId, targetName } = buildEmitTargetInfo(realTargetIds);

  return {
    action: user
      ? {
          userId,
          userName,
          skillKey: skill.key,
          skillName: skill.name,
          targetId,
          targetName,
        }
      : null,
    damageEvents: mainDamage,
    healEvents: mainHeal,
    shieldEvents: mainShield,
    buffEvents: mainBuff,
    resourceEvents: mainResource,
    dialogEvents: mainDialog,
    state: snapshotChampions([...affectedIds]),
  };
}

function buildReactionEnvelopesFromContext({ user, skill, context }) {
  const {
    damageEvents = [],
    healEvents = [],
    shieldEvents = [],
    buffEvents = [],
    resourceEvents = [],
    dialogEvents = [],
  } = context.visual || {};

  const userId = user?.id ?? null;
  const userName = user?.name ?? null;

  const allDepths = new Set([
    ...damageEvents.map((e) => e.damageDepth ?? 0),
    ...healEvents.map((e) => e.damageDepth ?? 0),
    ...shieldEvents.map((e) => e.damageDepth ?? 0),
    ...buffEvents.map((e) => e.damageDepth ?? 0),
    ...resourceEvents.map((e) => e.damageDepth ?? 0),
    ...dialogEvents.map((e) => e.damageDepth ?? 0),
  ]);

  const reactionDepths = [...allDepths]
    .filter((depth) => depth > 0)
    .sort((a, b) => a - b);

  const envelopes = [];

  for (const depth of reactionDepths) {
    const damageForDepth = damageEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const healForDepth = healEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const shieldForDepth = shieldEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const buffForDepth = buffEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const resourceForDepth = resourceEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const dialogForDepth = dialogEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );

    const affectedForDepth = new Set(
      [
        ...damageForDepth,
        ...healForDepth,
        ...shieldForDepth,
        ...buffForDepth,
        ...resourceForDepth,
      ]
        .map((e) => e.targetId)
        .filter(Boolean),
    );

    const reactionTargetIds = [
      ...new Set(
        [...damageForDepth, ...healForDepth, ...shieldForDepth]
          .map((e) => e.targetId)
          .filter((id) => id && id !== userId),
      ),
    ];

    const { targetId, targetName } = buildEmitTargetInfo(reactionTargetIds);

    envelopes.push({
      action: {
        userId: damageForDepth[0]?.sourceId ?? userId,
        userName:
          match.combat.activeChampions.get(damageForDepth[0]?.sourceId)?.name ??
          userName,
        skillKey: `${skill.key}-reaction-${depth}`,
        skillName: `${skill.name} (Reação ${depth})`,
        targetId,
        targetName,
      },
      damageEvents: damageForDepth,
      healEvents: healForDepth,
      shieldEvents: shieldForDepth,
      buffEvents: buffForDepth,
      resourceEvents: resourceForDepth,
      dialogEvents: dialogForDepth,
      state: snapshotChampions([...affectedForDepth]),
    });
  }

  return envelopes;
}

/**
 * Gera snapshots serializados dos campeões a partir de uma lista de IDs.
 * Usado para enviar o estado final pós-ação ao cliente.
 */
function snapshotChampions(ids) {
  if (!ids || ids.length === 0) return null;

  const uniqueIds = [...new Set(ids)];
  const snapshots = [];

  for (const id of uniqueIds) {
    const champion = match.combat.activeChampions.get(id);
    if (champion?.serialize) snapshots.push(champion.serialize());
  }

  return snapshots.length > 0 ? snapshots : null;
}

/**
 * Emite um envelope de ação de combate para todos os clientes.
 * Formato:
 *   action  — info sobre a skill usada (null para passivas/efeitos de turno)
 *   effects — array ordenado de efeitos a animar
 *   log     — texto verboso para o log de combate
 *   state   — snapshots do estado final dos campeões afetados
 */
function emitCombatAction(envelope) {
  if (!envelope) return;

  io.emit("combatAction", envelope);
}

// ============================================================
//  EXECUÇÃO DE HABILIDADES
// ============================================================

function resolveTargets(skill, user, targetIds) {
  // ALL
  if (skill.targetSpec?.includes("all")) {
    return [...match.combat.activeChampions.values()].filter((c) => c.alive);
  }

  // ALL ALLY
  if (skill.targetSpec?.includes("all:ally")) {
    return [...match.combat.activeChampions.values()].filter(
      (c) => c.alive && c.team === user.team,
    );
  }

  // ALL ENEMY
  if (skill.targetSpec?.includes("all:enemy")) {
    return [...match.combat.activeChampions.values()].filter(
      (c) => c.alive && c.team !== user.team,
    );
  }

  // SINGLE TARGET (usa targetIds do cliente)
  const targets = [];
  for (const role in targetIds) {
    const champ = match.combat.activeChampions.get(targetIds[role]);
    if (champ) targets.push(champ);
  }

  return targets;
}

/** Executa a habilidade, emite payloads e registra no histórico. */
function performSkillExecution(
  user,
  skill,
  targets,
  actionResourceCost = 0,
  context,
) {
  // 🔹 1. Criar contexto
  context ??= createBaseContext({ sourceId: user.id });
  context.currentSkill = skill;

  // 🔹 2. Injetar contexto nos campeões
  match.combat.activeChampions.forEach((champion) => {
    champion.runtime = champion.runtime || {};
    champion.runtime.currentContext = context;
  });

  context.currentSkill = skill;

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
  match.combat.activeChampions.forEach((champion) => {
    if (champion.runtime) delete champion.runtime.currentContext;
  });

  // 🔹 5. Registrar no histórico do turno
  registerSkillUsageInTurn(user, skill, targets);

  // 🔹 6. Normalizar resultado
  const results = Array.isArray(result) ? result : result ? [result] : [];

  applyUltMeterFromContext({ user, context });

  for (const r of results) {
    if (r?.extraEffects?.some((e) => e.type === "dialog")) {
      console.log(
        "🔵 SERVER → dialog recebido do processDamageEvent:",
        r.extraEffects,
      );
    }
  }

  // 🔹 7. Emitir envelopes
  emitCombatEnvelopesFromContext({
    results,
    user,
    skill,
    targets,
    context,
    actionResourceCost,
  });

  emitCombatEvent(
    "onActionResolved",
    {
      source: user,
      skill,
      context,
    },
    match.combat.activeChampions,
  );
}

function registerSkillUsageInTurn(user, skill, targets) {
  logTurnEvent("skillUsed", {
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

  const turnData = ensureTurnEntry();

  if (!turnData.skillsUsedThisTurn[user.id]) {
    turnData.skillsUsedThisTurn[user.id] = [];
  }

  turnData.skillsUsedThisTurn[user.id].push(skill.key);
}

/** Executa uma ação individual pendente. */
function executeSkillAction(action) {
  console.log("[EXECUTE SKILL ACTION] [TARGETS]", action);
  const user = match.combat.activeChampions.get(action.championId);

  if (!user || !user.alive) {
    const userName = user ? formatChampionName(user) : "campeão desconhecido";
    io.emit("combatLog", `Ação de ${userName} ignorada (não ativo).`);
    refundActionResource(user, action);
    return false;
  }

  const denial = canExecuteAction(user, action);

  if (denial?.denied) {
    io.emit("combatAction", {
      dialogEvents: [
        {
          message: denial.message,
          blocking: true,
        },
      ],
    });

    refundActionResource(user, action);
    return false;
  }

  const skill = user.skills.find((s) => s.key === action.skillKey);
  if (!skill) {
    io.emit(
      "combatLog",
      `Erro: Habilidade ${action.skillKey} não encontrada para ${formatChampionName(user)}.`,
    );
    refundActionResource(user, action);
    return false;
  }

  const context = createBaseContext({ sourceId: user.id });

  const roleTargets = resolveSkillTargets(user, skill, action, context);

  console.log("STEP 1 - TARGETS:", roleTargets);
  if (!roleTargets) {
    refundActionResource(user, action);
    return false;
  }

  // injetar ação e alvos resolvidos no contexto para uso durante a execução
  /*   context.currentAction = action;
  context.turnActions = turnActions; */

  const targetsArray = Object.values(roleTargets);
  console.log("STEP 2 - TARGETS ARRAY:", targetsArray);

  performSkillExecution(
    user,
    skill,
    targetsArray,
    action.resourceCost,
    context,
  );
  return true;
}

function createBaseContext({ sourceId = null } = {}) {
  const aliveChampionsArray = [...match.combat.activeChampions.values()].filter(
    (c) => c.alive,
  );

  return {
    currentTurn: match.combat.currentTurn,
    editMode,
    allChampions: match.combat.activeChampions,
    aliveChampions: aliveChampionsArray,

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
    },

    healSourceId: sourceId,
    buffSourceId: sourceId,

    // ========================
    // REGISTRIES
    // ========================

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

    registerHeal({ target, amount, sourceId } = {}) {
      const value = Number(amount) || 0;
      if (!target?.id || value <= 0) return;

      const sourceChamp =
        match.combat.activeChampions.get(sourceId) ||
        match.combat.activeChampions.get(this.healSourceId) ||
        target;

      this.visual.healEvents.push({
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

    registerBuff({ target, amount, statName, sourceId } = {}) {
      const value = Number(amount) || 0;
      if (!target?.id || value === 0) return;

      this.visual.buffEvents.push({
        type: "buff",
        targetId: target.id,
        sourceId: sourceId || this.buffSourceId || target.id,
        amount: value,
        statName,
      });
    },

    registerShield({ target, amount, sourceId } = {}) {
      const value = Number(amount) || 0;
      if (!target?.id || value <= 0) return;

      this.visual.shieldEvents.push({
        type: "shield",
        targetId: target.id,
        sourceId: sourceId || this.healSourceId || target.id,
        amount: value,
      });
    },

    registerResourceChange({ target, amount, sourceId } = {}) {
      const value = Number(amount) || 0;
      if (!target?.id || value === 0) return 0;

      let applied = 0;

      if (value > 0) {
        applied = target.addUlt({
          amount: value,
          source: match.combat.activeChampions.get(sourceId) || target,
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
          source: match.combat.activeChampions.get(sourceId) || null,
        },
        this.allChampions,
      );

      return applied;
    },

    registerUltGain({ target, amount, sourceId } = {}) {
      const value = Number(amount) || 0;
      if (!target?.id || value <= 0) return 0;

      const applied = amount ?? 0;
      if (applied > 0) {
        this.visual.resourceEvents.push({
          type: "resourceGain",
          targetId: target.id,
          sourceId: sourceId || target.id,
          amount: applied,
        });
      }

      return applied;
    },
  };
}

// ============================================================
//  RESOLUÇÃO DE TURNOS
// ============================================================

/** Ordena e executa todas as ações pendentes (prioridade > velocidade > desempate). */
function resolveSkillActions() {
  console.log(
    `[TARGETS DEBUG] [TURN ${match.combat.currentTurn}] [resolveSkillActions] Resolvendo ações...`,
    match.combat.pendingActions,
  );

  match.combat.pendingActions.forEach((a) => {
    a._tieBreaker = Math.random();

    const champ = match.combat.activeChampions.get(a.championId);

    // default
    a.priorityBias = 0;

    if (champ?.ignoreEnemyPriority) {
      a.priorityBias = 1000;
    }
  });

  match.combat.pendingActions.sort((a, b) => {
    const aPriority = (a.priority || 0) + (a.priorityBias || 0);
    const bPriority = (b.priority || 0) + (b.priorityBias || 0);

    if (bPriority !== aPriority) return bPriority - aPriority;

    if (b.speed !== a.speed) return b.speed - a.speed;

    return b._tieBreaker - a._tieBreaker;
  });

  match.combat.pendingActions.forEach((action, index) => {
    action.initiativeIndex = index;
  });

  const turnActions = [...match.combat.pendingActions];

  for (const action of match.combat.pendingActions) {
    console.log(
      `[TARGETS] [TURN ${match.combat.currentTurn}] Executando ação de ${action.championId} (Skill: ${action.skillKey}, Targets: ${JSON.stringify(action.targetIds)})`,
    );
    executeSkillAction(action, turnActions);
  }

  match.combat.clearActions();
}

function handleEndTurn() {
  console.log("teste: TARGETS");
  io.emit("turnLocked");
  console.log(
    "[handleEndTurn] [TARGETS DEBUG] Turno finalizado. Chamando resolveSkillActions...",
  );
  resolveSkillActions();
  processChampionsDeaths();

  const context = {
    currentTurn: match.combat.currentTurn,
    activeChampions: Array.from(match.combat.activeChampions.values()).filter(
      (c) => c.alive,
    ),
  };

  emitCombatEvent("onTurnEnd", { context }, match.combat.activeChampions);

  // NÃO chama início de turno aqui.
  // Espera confirmação do client.
}

/** Remove campeões mortos do jogo e verifica fim de partida. */
function processChampionsDeaths() {
  for (const champ of match.combat.activeChampions.values()) {
    if (!champ.alive) {
      removeChampionFromGame(champ.id, champ.team);
    }
  }

  if (match.isGameEnded()) {
    const winnerSlot = match.combat.playerScores[0] >= MAX_SCORE ? 0 : 1;
    const winnerTeam = winnerSlot + 1;
    const winnerName = match.players[winnerSlot]?.username;

    io.emit("gameOver", {
      winnerTeam,
      winnerName,
    });
  }
}

/** Aplica regeneração global de HP/MP/Energy no início do turno. */
function handleStartTurn() {
  match.combat.nextTurn();
  match.combat.clearTurnReadiness();

  const turnStartContext = createBaseContext({ sourceId: null });

  // 1. Injetar contexto
  match.combat.activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    champ.runtime = champ.runtime || {};
    champ.runtime.currentContext = turnStartContext;
  });

  /*   POSSIVELMENTE OBSOLETO com novo modelo de hooks e .js de cada statusEffect
// 2. Tick DoTs e outras statusEffects de início de turno
  processTurnStartStatusEffects({
    activeChampions: Array.from(match.combat.activeChampions.values()),
    context: turnStartContext,
  }); */

  // 4. Hooks onTurnStart
  emitCombatEvent(
    "onTurnStart",
    { context: turnStartContext },
    match.combat.activeChampions,
  );

  // 3. Limpar expirados
  match.combat.activeChampions.forEach((champion) => {
    champion.purgeExpiredStatModifiers(match.combat.currentTurn);
    champion.purgeExpiredStatusEffects(match.combat.currentTurn);
  });

  // 5. Regen global
  match.combat.activeChampions.forEach((champion) => {
    const applied = applyGlobalTurnRegen(champion, turnStartContext);

    console.log(
      "[ULT REGEN]",
      champion.name,
      "aplicado:",
      applied,
      "depois:",
      champion.ultMeter,
    );
  });

  // 6. Limpar runtime context
  match.combat.activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  // 🔹 7. Emit envelope (novo modelo)
  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "turn_start", name: "Início do Turno" },
    context: turnStartContext,
  });

  io.emit("turnUpdate", match.combat.currentTurn);
  io.emit("gameStateUpdate", getGameState());
}

// ============================================================
//  RESET DO ESTADO DO JOGO
// ============================================================

/** Reseta completamente o estado do jogo (todos desconectados ou timeout). */
function resetGameState() {
  match.clearPlayers();
}

/** Reseta o estado de combate (HP, buffs, ult, etc.) mantendo os campeões e jogadores (debug/test only). */
function resetCombatState() {
  const snapshot = [...match.combat.combatSnapshot];

  match.combat.reset();

  for (const champ of snapshot) {
    const baseData = championDB[champ.championKey];

    const newChampion = Champion.fromBaseData(baseData, champ.id, champ.team);

    match.combat.registerChampion(newChampion, { trackSnapshot: false });
  }

  match.combat.combatSnapshot = snapshot;
  match.combat.start();

  console.log("[DEBUG] Combat state reset.");
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

io.on("connection", (socket) => {
  console.log("Um usuário conectado:", socket.id);

  // Envia editMode IMEDIATAMENTE ao client SEM propriedades server-only (damageOutput, alwaysCrit, etc.)
  const { damageOutput, alwaysCrit, ...clientEditMode } = editMode;
  socket.emit("editModeUpdate", clientEditMode);

  // --- Socket handler para reset de combate (debug) ---
  socket.on("debugResetCombat", () => {
    resetCombatState();
    io.emit("gameStateUpdate", getGameState());
  });

  // --- Socket handler para início de turno após animações ---
  socket.on("combatAnimationsFinished", () => {
    match.addFinishedAnimationSocket(socket.id);

    const totalPlayers = io.engine.clientsCount;

    if (match.getFinishedAnimationCount() === totalPlayers) {
      match.clearFinishedAnimationSockets();
      handleStartTurn();
    }
  });

  // --- Helpers internos à conexão ---

  /** Atribui um slot de jogador e notifica o cliente. */
  function assignPlayerSlot(username) {
    let slot = -1;
    if (match.getPlayer(0) === null) slot = 0;
    else if (match.getPlayer(1) === null) slot = 1;

    if (slot === -1) {
      socket.emit(
        "serverFull",
        "O servidor está cheio. Tente novamente mais tarde.",
      );
      socket.disconnect();
      return null;
    }

    const playerId = `player${slot + 1}`;
    const team = slot + 1;
    const finalUsername =
      editMode.enabled && editMode.autoLogin ? `Player${slot + 1}` : username;

    const player = new Player({
      id: playerId,
      team,
      username: finalUsername,
    });
    player.setSocket(socket.id);
    player.clearChampionSelection();

    match.setPlayer(slot, player);

    match.assignSocketToSlot(socket.id, slot);

    socket.emit("playerAssigned", {
      playerId,
      team,
      username: finalUsername,
    });
    io.emit("playerCountUpdate", match.getConnectedCount());
    io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
    socket.emit("gameStateUpdate", getGameState());

    return { playerSlot: slot, finalUsername };
  }

  /** Inicia a seleção de campeões para jogadores pendentes. */
  function handleChampionSelection() {
    for (let i = 0; i < match.players.length; i++) {
      const player = match.players[i];
      if (!player || player.isTeamSelected()) continue;

      io.to(player.socketId).emit("startChampionSelection", {
        timeLeft: CHAMPION_SELECTION_TIME,
      });

      match.setSelectionTimer(
        i,
        setTimeout(() => {
          if (match.isTeamSelected(i)) return;

          let currentSelection = player.selectedChampionKeys.filter(
            (c) => c !== null,
          );
          while (currentSelection.length < TEAM_SIZE) {
            const champ = getRandomChampionKey(currentSelection);
            if (!champ) break;
            currentSelection.push(champ);
          }

          player.setSelectedChampionKeys(currentSelection);
          checkAllTeamsSelected();
        }, CHAMPION_SELECTION_TIME * 1000),
      );
    }
  }

  /** Seleção automática (editMode) ou delega para seleção manual. */
  function handleEditModeSelection() {
    for (let i = 0; i < match.players.length; i++) {
      const player = match.players[i];
      if (!player || player.isTeamSelected()) continue;

      let currentSelection = [];
      while (currentSelection.length < TEAM_SIZE) {
        const champ =
          getRandomChampionKey(currentSelection) || Object.keys(championDB)[0];
        currentSelection.push(champ);
      }

      player.setSelectedChampionKeys(currentSelection);
    }

    if (checkAllTeamsSelected()) {
      startGameIfReady();
    }
  }

  // =============================
  //  requestPlayerSlot
  // =============================

  socket.on("requestPlayerSlot", (username) => {
    const assignResult = assignPlayerSlot(username);
    if (!assignResult) return;

    const { playerSlot, finalUsername } = assignResult;

    // Aguarda segundo jogador
    if (!match.areBothPlayersConnected()) {
      socket.emit(
        "waitingForOpponent",
        `Olá, ${finalUsername}, aguardando outro jogador...`,
      );
      return;
    }

    io.emit("allPlayersConnected");

    // Seleção de campeões
    if (editMode.enabled && editMode.autoSelection) {
      handleEditModeSelection();
    } else {
      handleChampionSelection();
    }

    // Reconexão — cancela timer e notifica oponente
    if (match.getDisconnectionTimer(playerSlot)) {
      match.clearDisconnectionTimer(playerSlot);

      const otherPlayer = match.getOpponent(playerSlot);
      if (otherPlayer) {
        io.to(otherPlayer.socketId).emit("opponentReconnected");
      }
    }
  });

  function startGameIfReady() {
    if (!checkAllTeamsSelected()) return;
    if (match.isCombatStarted()) return;

    startNewMatch();
  }

  function startNewMatch() {
    match.resetCombat();
    match.startCombat();

    assignChampionsToTeam(
      match.players[0].team,
      match.players[0].selectedChampionKeys,
    );
    assignChampionsToTeam(
      match.players[1].team,
      match.players[1].selectedChampionKeys,
    );

    io.emit("scoreUpdate", match.getScorePayload());

    io.emit("gameStateUpdate", getGameState());
  }

  // =============================
  //  disconnect
  // =============================

  socket.on("disconnect", () => {
    let disconnectedSlot = match.getSlotBySocket(socket.id);

    if (disconnectedSlot === undefined) {
      // fallback: procura no array players
      disconnectedSlot = match.players.findIndex(
        (player) => player && player.socketId === socket.id,
      );
    }

    if (disconnectedSlot === -1 || disconnectedSlot === undefined) {
      console.warn("Disconnect de socket não mapeado:", socket.id);
      return;
    }

    const wasGameActive = match.areBothPlayersConnected();

    // Limpa timers pendentes
    match.clearDisconnectionTimer(disconnectedSlot);
    match.clearSelectionTimer(disconnectedSlot);

    // Libera slot
    const disconnectedPlayer = match.getPlayer(disconnectedSlot);
    disconnectedPlayer?.clearSocket();
    disconnectedPlayer?.clearChampionSelection();
    match.setPlayer(disconnectedSlot, null);
    match.removeSocket(socket.id);
    match.removeReadyPlayer(disconnectedSlot);
    match.clearActions();

    const connectedCount = match.getConnectedCount();
    io.emit("playerCountUpdate", connectedCount);
    io.emit("playerNamesUpdate", match.getPlayerNamesEntries());

    // Nenhum jogador restante — reset total
    if (connectedCount === 0) {
      resetGameState();
      io.emit("gameStateUpdate", getGameState());
      return;
    }

    // Um jogador restante com jogo ativo — inicia contagem regressiva
    if (wasGameActive && connectedCount === 1) {
      console.log("PLAYERS:", match.players);
      console.log("CONNECTED COUNT:", connectedCount);
      const remainingSlot = match.players[0] ? 0 : 1;
      const remainingSocketId = match.players[remainingSlot].socketId;

      io.to(remainingSocketId).emit("opponentDisconnected", {
        timeout: DISCONNECT_TIMEOUT,
      });

      const timer = setTimeout(() => {
        io.to(remainingSocketId).emit(
          "forceLogout",
          "Seu oponente se desconectou e não reconectou a tempo.",
        );

        match.setPlayer(remainingSlot, null);
        match.removeSocket(remainingSocketId);
        resetGameState();
        io.emit("playerCountUpdate", match.getConnectedCount());
        io.emit("playerNamesUpdate", match.getPlayerNamesEntries());
        io.emit("gameStateUpdate", getGameState());
      }, DISCONNECT_TIMEOUT);

      match.setDisconnectionTimer(disconnectedSlot, timer);
    }
  });

  // =============================
  //  selectTeam
  // =============================

  socket.on(
    "selectTeam",
    ({ team: clientTeam, champions: selectedChampionKeys }) => {
      const playerSlot = match.getSlotBySocket(socket.id);
      const player = match.players[playerSlot];

      if (!player || player.team !== clientTeam) {
        socket.emit(
          "actionFailed",
          "Você não tem permissão para selecionar campeões para este time.",
        );
        return;
      }

      if (player.isTeamSelected()) {
        socket.emit("actionFailed", "Você já confirmou sua equipe.");
        return;
      }

      player.setSelectedChampionKeys(selectedChampionKeys);

      startGameIfReady();
    },
  );

  // =============================
  //  removeChampion (edit mode / debug)
  // =============================

  socket.on("removeChampion", ({ championId }) => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];
    const championToRemove = match.combat.activeChampions.get(championId);

    if (!player || !championToRemove || championToRemove.team !== player.team) {
      socket.emit(
        "actionFailed",
        "Você não tem permissão para remover este campeão.",
      );
      return;
    }

    removeChampionFromGame(championId, player.team);
  });

  // =============================
  //  requestSkillUse → skillApproved / skillDenied
  // =============================

  socket.on("requestSkillUse", ({ userId, skillKey }) => {
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];
    const user = match.combat.activeChampions.get(userId);

    if (!player || !user || user.team !== player.team) {
      return socket.emit("skillDenied", "Sem permissão.");
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) return socket.emit("skillDenied", "Skill inválida.");

    if (!validateActionIntent(user, skill, socket)) return;

    if (!skill.isUltimate) {
      return socket.emit("skillApproved", { userId, skillKey });
    }

    const cost = user.getSkillCost(skill);

    if (!editMode.freeCostSkills && cost > user.ultMeter) {
      return socket.emit("skillDenied", `ultômetro insuficiente.`);
    }

    socket.emit("skillApproved", { userId, skillKey });
  });

  // =============================
  //  requestUndoActions (cancela ações pendentes do time do jogador)
  // =============================
  socket.on("requestUndoActions", () => {
    if (!match.combat.pendingActions.length) {
      console.warn("Pedido de undo sem ações pendentes.");
      return;
    }

    const playerSlot = match.getSlotBySocket(socket.id);

    if (playerSlot === undefined) return;

    const playerTeam = playerSlot + 1;

    console.log("[UNDO] Player team:", playerTeam);

    for (let i = match.combat.pendingActions.length - 1; i >= 0; i--) {
      const action = match.combat.pendingActions[i];
      const champ = match.combat.activeChampions.get(action.championId);

      if (!champ) continue;

      if (champ.team !== playerTeam) continue;

      // reverter estado
      champ.hasActedThisTurn = false;

      if (action.ultCost > 0) {
        champ.addUlt(action.ultCost);
      }

      match.combat.pendingActions.splice(i, 1);
    }

    // 🔥 remover confirmação de fim de turno
    if (match.isPlayerReady(playerSlot)) {
      match.removeReadyPlayer(playerSlot);
      io.emit("playerCanceledEndTurn", playerSlot);
    }

    socket.emit("actionsCanceled");
  });

  // =============================
  //  useSkill (enfileira ação pendente)
  // =============================

  socket.on("useSkill", ({ userId, skillKey, targetIds }) => {
    console.log("[USE SKILL] Recebido pedido de uso de skill:", {
      userId,
      skillKey,
      targetIds,
    });
    const playerSlot = match.getSlotBySocket(socket.id);
    const player = match.players[playerSlot];
    const user = match.combat.activeChampions.get(userId);

    if (!player || !user || user.team !== player.team) {
      return socket.emit(
        "actionFailed",
        "Você não tem permissão para usar habilidades com este campeão.",
      );
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) {
      return socket.emit("actionFailed", "Habilidade não encontrada.");
    }

    // 🔥 Apenas ultimates têm custo
    let cost = 0;

    if (skill.isUltimate === true) {
      cost = user.getSkillCost(skill);

      if (!editMode.freeCostSkills && user.ultMeter < cost) {
        return socket.emit("actionFailed", "Ultômetro insuficiente.");
      }

      if (!editMode.freeCostSkills) {
        user.spendUlt(cost);
      }
    }

    match.enqueueAction({
      championId: userId,
      skillKey,
      targetIds,
      priority: skill.priority || 0,
      speed: user.Speed,
      turn: match.getCurrentTurn(),
      ultCost: cost,
    });

    console.log("[PENDING ACTION ADDED]", match.combat.pendingActions);

    io.to(socket.id).emit(
      "combatLog",
      `${formatChampionName(user)} usou ${skill.name}. Ação pendente.`,
    );
  });

  // =============================
  //  surrender (Render-se)
  // =============================

  socket.on("surrender", () => {
    if (match.isGameEnded()) return;

    const playerSlot = match.getSlotBySocket(socket.id);
    if (playerSlot === undefined) return;

    const player = match.players[playerSlot];
    if (!player) return;

    const surrenderingTeam = player.team;
    const winnerTeam = surrenderingTeam === 1 ? 2 : 1;
    const winnerSlot = winnerTeam - 1;
    const winnerName = match.players[winnerSlot]?.username;

    match.setWinnerScore(winnerSlot, MAX_SCORE);
    io.emit("scoreUpdate", match.getScorePayload());

    io.emit("gameOver", {
      winnerTeam,
      winnerName,
    });
  });

  // =============================
  //  endTurn
  // =============================

  socket.on("endTurn", () => {
    if (match.isGameEnded()) {
      socket.emit("actionFailed", "O jogo já terminou.");
      return;
    }

    const playerSlot = match.getSlotBySocket(socket.id);
    if (playerSlot === undefined) {
      socket.emit(
        "actionFailed",
        "Você não está em um slot de jogador válido.",
      );
      return;
    }

    match.addReadyPlayer(playerSlot);
    io.emit("playerConfirmedEndTurn", playerSlot);

    if (match.getReadyPlayersCount() === 2) {
      // Valida se ambos ainda estão conectados
      if (!match.areBothPlayersConnected()) {
        match.clearTurnReadiness();
        socket.emit(
          "actionFailed",
          "Seu oponente foi desconectado. O turno foi cancelado.",
        );
        return;
      }
      handleEndTurn();
    } else {
      socket.emit(
        "waitingForOpponentEndTurn",
        "Aguardando o outro jogador confirmar o fim do turno.",
      );
    }
  });
});

// ============================================================
//  INICIALIZAÇÃO DO SERVIDOR
// ============================================================

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
