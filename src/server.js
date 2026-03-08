// ============================================================
//  HELPERS DE MANIPULAÇÃO DE ULTÔMETRO
// ============================================================
/**
 * Aplica regeneração global de ultMeter (+2 unidades por turno)
 */
function applyGlobalTurnRegen(champion, context) {
  if (!champion || !champion.alive) return 0;

  const GLOBAL_ULT_REGEN = 2; // +2 unidades por turno (conforme spec)

  const applied = champion.addUlt({
    amount: GLOBAL_ULT_REGEN,
    context,
  });

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
    const regenAmount = context.currentSkill?.isUltimate ? 1 : 2;
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
    const target = activeChampions.get(targetId);
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
  actMultipleTimesPerTurn: true,
  unavailableChampions: false,
  damageOutput: null, // Valor fixo de dano para testes (ex: 999). null = desativado. (SERVER-ONLY)
  alwaysCrit: false, // Força crítico em todo ataque. (SERVER-ONLY)
  alwaysEvade: false, // Força evasão em todo ataque. (SERVER-ONLY)
  executionOverride: null, // null = normal
  // number = força threshold (ex: 1 = 100%, 0.5 = 50%)
  freeCostSkills: true, // Habilidades não consomem recurso. (SERVER-ONLY)
};

const TEAM_SIZE = 3;
const MAX_SCORE = 3; // primeiro a derrotar 3 campeões inimigos
const CHAMPION_SELECTION_TIME = 120; // Segundos para seleção de campeões
const DISCONNECT_TIMEOUT = 30 * 1000; // 30 s para reconexão

let gameStarted = false;

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

// --- Jogadores ---
let players = [null, null]; // slot 0 = Time 1, slot 1 = Time 2
let connectedSockets = new Map(); // socket.id → slot
let playerNames = new Map(); // slot → username
let playerTeamsSelected = [false, false];
let championSelectionTimers = [null, null];
let playerScores = [0, 0];
let gameEnded = false;

// --- Combate ---
const activeChampions = new Map();
let currentTurn = 1;
let playersReadyToEndTurn = new Set();
let pendingActions = [];

// --- Desconexão ---
let disconnectionTimers = new Map(); // slot → timeout ID

// ============================================================
//  HISTÓRICO DE TURNOS
// ============================================================

/** turno → { events[], championsDeadThisTurn[], skillsUsedThisTurn{}, damageDealtThisTurn{} } */
let turnHistory = new Map();

/** Garante que a entrada do turno atual existe no histórico. */
function ensureTurnEntry() {
  if (!turnHistory.has(currentTurn)) {
    turnHistory.set(currentTurn, {
      events: [],
      championsDeadThisTurn: [],
      skillsUsedThisTurn: {},
      damageDealtThisTurn: {},
    });
  }
  return turnHistory.get(currentTurn);
}

/** Registra um evento no histórico do turno atual. */
function logTurnEvent(eventType, eventData) {
  const turnData = ensureTurnEntry();
  turnData.events.push({
    type: eventType,
    ...eventData,
    timestamp: Date.now(),
  });
}

// ============================================================
//  SERIALIZAÇÃO DO ESTADO
// ============================================================

function getGameState() {
  return {
    champions: Array.from(activeChampions.values()).map((c) => c.serialize()),
    currentTurn,
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

    activeChampions.set(id, newChampion);
  });
}

/** Verifica se ambos os jogadores selecionaram seus times e notifica os clientes. */
function checkAllTeamsSelected() {
  if (playerTeamsSelected[0] && playerTeamsSelected[1]) {
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
  const championToRemove = activeChampions.get(championId);
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

  if (!gameEnded) {
    playerScores[scoringPlayerSlot]++;
    io.emit("scoreUpdate", {
      player1: playerScores[0],
      player2: playerScores[1],
    });

    io.emit(
      "combatLog",
      `${formatPlayerName(playerNames.get(scoringPlayerSlot), scoringTeam)} marcou um ponto!`,
    );

    if (playerScores[scoringPlayerSlot] >= MAX_SCORE) {
      gameEnded = true;
    }
  }

  activeChampions.delete(championId);
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
  if (!user.alive) {
    socket.emit("skillDenied", "Campeão morto.");
    return false;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    socket.emit("skillDenied", "Já agiu neste turno.");
    return false;
  }

  const result = emitCombatEvent("onValidateAction", { user, skill });

  if (result?.messages?.length) {
    result.messages.forEach((msg) => socket.emit("skillDenied", msg));
  }

  return true;
}

/**
 * Valida se o campeão pode EXECUTAR a ação no momento da resolução do turno.
 * Diferente de validateActionIntent — aqui o estado pode ter mudado.
 */
function canExecuteAction(user, action) {
  if (!user || !user.alive) return false;

  const result = emitCombatEvent(
    "onValidateAction",
    {
      user,
      skill: action?.skill,
      action,
      phase: "execution",
    },
    activeChampions,
  );

  if (!result) return true;

  if (result?.messages?.length) {
    result.messages.forEach((msg) => io.emit("combatLog", msg));
  }

  if (result.deny) {
    return false;
  }

  return true;
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
    (effect) => effect.expiresAtTurn > currentTurn,
  );

  const hasTaunt = !!activeTaunt;

  const canRedirect =
    hasTaunt && action?.targetIds && Object.keys(action.targetIds).length > 0;

  // =========================
  // REDIRECTION
  // =========================

  if (canRedirect && Array.isArray(skill.targetSpec)) {
    const taunter = activeChampions.get(activeTaunt.taunterId);

    if (taunter && taunter.alive) {
      let redirectionEvents = [];

      skill.targetSpec.forEach((spec, index) => {
        const type = typeof spec === "string" ? spec : spec.type;

        if (type !== "enemy") return;

        const roleKey = index === 0 ? "enemy" : `enemy${index + 1}`;

        const originalId = action.targetIds?.[roleKey];

        if (!originalId) return;

        const original = activeChampions.get(originalId);
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
          const target = activeChampions.get(action.targetIds[role]);
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
        const enemies = Array.from(activeChampions.values()).filter(
          (c) => c.team !== user.team && c.alive,
        );

        enemies.forEach((enemy, i) => {
          const key = i === 0 ? "enemy" : `enemy${i + 1}`;
          currentTargets[key] = enemy;
        });
      }

      if (hasAllAllies || hasAll) {
        const allies = Array.from(activeChampions.values()).filter(
          (c) => c.team === user.team && c.alive,
        );

        allies.forEach((ally, i) => {
          const key = i === 0 ? "ally" : `ally${i + 1}`;
          currentTargets[key] = ally;
        });
      }
    } else if (action?.targetIds) {
      for (const role in action.targetIds) {
        const target = activeChampions.get(action.targetIds[role]);

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
    const champ = activeChampions.get(realTargetIds[0]);
    targetName = champ ? formatChampionName(champ) : null;
  } else if (realTargetIds.length > 1) {
    const names = realTargetIds.map((id) => {
      const champ = activeChampions.get(id);
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
      [...activeChampions.values()].map((c) => ({
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
          activeChampions.get(damageForDepth[0]?.sourceId)?.name ?? userName,
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
    const champion = activeChampions.get(id);
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
    return [...activeChampions.values()].filter((c) => c.alive);
  }

  // ALL ALLY
  if (skill.targetSpec?.includes("all:ally")) {
    return [...activeChampions.values()].filter(
      (c) => c.alive && c.team === user.team,
    );
  }

  // ALL ENEMY
  if (skill.targetSpec?.includes("all:enemy")) {
    return [...activeChampions.values()].filter(
      (c) => c.alive && c.team !== user.team,
    );
  }

  // SINGLE TARGET (usa targetIds do cliente)
  const targets = [];
  for (const role in targetIds) {
    const champ = activeChampions.get(targetIds[role]);
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
  activeChampions.forEach((champion) => {
    champion.runtime = champion.runtime || {};
    champion.runtime.currentContext = context;
  });

  context.currentSkill = skill;

  // 🔹 3. Executar skill
  const result = skill.resolve({
    user,
    targets,
    context,
  });

  // 🔹 4. Limpar contexto
  activeChampions.forEach((champion) => {
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
      user,
      skill,
      context,
    },
    activeChampions,
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
  const user = activeChampions.get(action.championId);

  if (!user || !user.alive) {
    const userName = user ? formatChampionName(user) : "campeão desconhecido";
    io.emit("combatLog", `Ação de ${userName} ignorada (não ativo).`);
    refundActionResource(user, action);
    return false;
  }

  if (!canExecuteAction(user, action)) {
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
  const aliveChampionsArray = [...activeChampions.values()].filter(
    (c) => c.alive,
  );

  return {
    currentTurn,
    editMode,
    allChampions: activeChampions,
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
        activeChampions.get(sourceId) ||
        activeChampions.get(this.healSourceId) ||
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
          source: activeChampions.get(sourceId) || target,
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
          source: activeChampions.get(sourceId) || null,
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
  pendingActions.forEach((a) => {
    a._tieBreaker = Math.random();

    const champ = activeChampions.get(a.championId);

    // default
    a.priorityBias = 0;

    if (champ?.ignoreEnemyPriority) {
      a.priorityBias = 1000;
    }
  });

  pendingActions.sort((a, b) => {
    const aPriority = (a.priority || 0) + (a.priorityBias || 0);
    const bPriority = (b.priority || 0) + (b.priorityBias || 0);

    if (bPriority !== aPriority) return bPriority - aPriority;

    if (b.speed !== a.speed) return b.speed - a.speed;

    return b._tieBreaker - a._tieBreaker;
  });

  pendingActions.forEach((action, index) => {
    action.initiativeIndex = index;
  });

  const turnActions = [...pendingActions];

  for (const action of pendingActions) {
    executeSkillAction(action, turnActions);
  }

  pendingActions = [];
}

function handleEndTurn() {
  resolveSkillActions();
  processChampionsDeaths();

  const context = {
    currentTurn,
    activeChampions: Array.from(activeChampions.values()).filter(
      (c) => c.alive,
    ),
  };

  emitCombatEvent("onTurnEnd", context, activeChampions);

  // NÃO chama início de turno aqui.
  // Espera confirmação do client.
}

/** Remove campeões mortos do jogo e verifica fim de partida. */
function processChampionsDeaths() {
  for (const champ of activeChampions.values()) {
    if (!champ.alive) {
      removeChampionFromGame(champ.id, champ.team);
    }
  }

  if (gameEnded) {
    const winnerSlot = playerScores[0] >= MAX_SCORE ? 0 : 1;
    const winnerTeam = winnerSlot + 1;
    const winnerName = playerNames.get(winnerSlot);

    io.emit("gameOver", {
      winnerTeam,
      winnerName,
    });
  }
}

/** Aplica regeneração global de HP/MP/Energy no início do turno. */
function handleStartTurn() {
  currentTurn++;
  playersReadyToEndTurn.clear();

  const turnStartContext = createBaseContext({ sourceId: null });

  // 1. Injetar contexto
  activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    champ.runtime = champ.runtime || {};
    champ.runtime.currentContext = turnStartContext;
  });

  /*   POSSIVELMENTE OBSOLETO com novo modelo de hooks e .js de cada statusEffect
// 2. Tick DoTs e outras statusEffects de início de turno
  processTurnStartStatusEffects({
    activeChampions: Array.from(activeChampions.values()),
    context: turnStartContext,
  }); */

  // 3. Limpar expirados
  activeChampions.forEach((champion) => {
    champion.purgeExpiredStatModifiers(currentTurn);
    champion.purgeExpiredStatusEffects(currentTurn);
  });

  // 4. Hooks onTurnStart
  emitCombatEvent(
    "onTurnStart",
    { context: turnStartContext },
    activeChampions,
  );

  // 5. Regen global
  activeChampions.forEach((champion) => {
    const applied = applyGlobalTurnRegen(champion, turnStartContext);

    console.log(
      "[ULT REGEN]",
      champion.name,
      "antes:",
      champion.ultMeter,
      "aplicado:",
      applied,
      "depois:",
      champion.ultMeter,
    );
  });

  // 6. Limpar runtime context
  activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  // 🔹 7. Emit envelope (novo modelo)
  emitCombatEnvelopesFromContext({
    user: null,
    skill: { key: "turn_start", name: "Início do Turno" },
    context: turnStartContext,
  });

  io.emit("turnUpdate", currentTurn);
  io.emit("gameStateUpdate", getGameState());
}

// POSSIVELMENTE OBSOLETO com novo modelo de hooks e .js de cada statusEffect
/** Processa statusEffects que disparam no início do turno (DoTs, etc). */
/* function processTurnStartStatusEffects({ activeChampions, context }) {
  const affectedIds = new Set();
  const logs = [];

  activeChampions.forEach((champion) => {
    if (!champion.alive) return;

    for (const [statusEffectName] of champion.statusEffects) {
      const effect = StatusEffectTurnEffects?.[statusEffectName];
      if (!effect?.onTurnStart) continue;

      const result = effect.onTurnStart({
        champion,
        context,
        allChampions: activeChampions,
      });

      if (!result) continue;

      if (result.type === "damage") {
        const damage = Math.max(0, Number(result.amount) || 0);

        champion.takeDamage(damage, context);

        context.registerDamage({
          target: champion,
          amount: damage,
          sourceId: result.sourceId ?? null,
          isDot: true,
        });

        affectedIds.add(champion.id);
      }

      if (result.log) logs.push(result.log);
    }
  });

  const { damageEvents = [] } = context.visual || {};

  if (damageEvents.length === 0) return;
} */
// ============================================================
//  RESET DO ESTADO DO JOGO
// ============================================================

/** Reseta completamente o estado do jogo (todos desconectados ou timeout). */
function resetGameState() {
  activeChampions.clear();
  currentTurn = 1;
  turnHistory.clear();
  playerScores = [0, 0];
  gameEnded = false;
  gameStarted = false;
  playerTeamsSelected = [false, false];
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

const playersFinishedAnimations = new Set();

io.on("connection", (socket) => {
  console.log("Um usuário conectado:", socket.id);

  // Envia editMode IMEDIATAMENTE ao client SEM propriedades server-only (damageOutput, alwaysCrit, etc.)
  const { damageOutput, alwaysCrit, ...clientEditMode } = editMode;
  socket.emit("editModeUpdate", clientEditMode);

  // --- Socket handler para início de turno após animações ---
  socket.on("combatAnimationsFinished", () => {
    playersFinishedAnimations.add(socket.id);

    const totalPlayers = io.engine.clientsCount;

    if (playersFinishedAnimations.size === totalPlayers) {
      playersFinishedAnimations.clear();
      handleStartTurn();
    }
  });

  // --- Helpers internos à conexão ---

  /** Atribui um slot de jogador e notifica o cliente. */
  function assignPlayerSlot(username) {
    let slot = -1;
    if (players[0] === null) slot = 0;
    else if (players[1] === null) slot = 1;

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

    players[slot] = {
      id: playerId,
      team,
      socketId: socket.id,
      username: finalUsername,
      selectedTeam: [],
    };

    connectedSockets.set(socket.id, slot);
    playerNames.set(slot, finalUsername);

    socket.emit("playerAssigned", {
      playerId,
      team,
      username: finalUsername,
    });
    io.emit("playerCountUpdate", players.filter((p) => p !== null).length);
    io.emit("playerNamesUpdate", Array.from(playerNames.entries()));
    socket.emit("gameStateUpdate", getGameState());

    return { playerSlot: slot, finalUsername };
  }

  /** Inicia a seleção de campeões para jogadores pendentes. */
  function handleChampionSelection() {
    for (let i = 0; i < players.length; i++) {
      if (!players[i] || playerTeamsSelected[i]) continue;

      io.to(players[i].socketId).emit("startChampionSelection", {
        timeLeft: CHAMPION_SELECTION_TIME,
      });

      championSelectionTimers[i] = setTimeout(() => {
        if (playerTeamsSelected[i]) return;

        let currentSelection = players[i].selectedTeam.filter(
          (c) => c !== null,
        );
        while (currentSelection.length < TEAM_SIZE) {
          const champ = getRandomChampionKey(currentSelection);
          if (!champ) break;
          currentSelection.push(champ);
        }

        players[i].selectedTeam = currentSelection;
        playerTeamsSelected[i] = true;
        checkAllTeamsSelected();
      }, CHAMPION_SELECTION_TIME * 1000);
    }
  }

  /** Seleção automática (editMode) ou delega para seleção manual. */
  function handleEditModeSelection() {
    for (let i = 0; i < players.length; i++) {
      if (!players[i] || playerTeamsSelected[i]) continue;

      let currentSelection = [];
      while (currentSelection.length < TEAM_SIZE) {
        const champ =
          getRandomChampionKey(currentSelection) || Object.keys(championDB)[0];
        currentSelection.push(champ);
      }

      players[i].selectedTeam = currentSelection;
      playerTeamsSelected[i] = true;
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
    if (!(players[0] && players[1])) {
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
    if (disconnectionTimers.has(playerSlot)) {
      clearTimeout(disconnectionTimers.get(playerSlot));
      disconnectionTimers.delete(playerSlot);

      const other = playerSlot === 0 ? 1 : 0;
      if (players[other]) {
        io.to(players[other].socketId).emit("opponentReconnected");
      }
    }
  });

  function startGameIfReady() {
    if (!checkAllTeamsSelected()) return;
    if (gameStarted) return;

    startNewMatch();
  }

  function startNewMatch() {
    gameStarted = true;

    activeChampions.clear();
    currentTurn = 1;
    turnHistory.clear();
    playerScores = [0, 0];
    gameEnded = false;

    assignChampionsToTeam(players[0].team, players[0].selectedTeam);
    assignChampionsToTeam(players[1].team, players[1].selectedTeam);

    io.emit("scoreUpdate", {
      player1: playerScores[0],
      player2: playerScores[1],
    });

    io.emit("gameStateUpdate", getGameState());
  }

  // =============================
  //  disconnect
  // =============================

  socket.on("disconnect", () => {
    let disconnectedSlot = connectedSockets.get(socket.id);

    if (disconnectedSlot === undefined) {
      // fallback: procura no array players
      disconnectedSlot = players.findIndex(
        (p) => p && p.socketId === socket.id,
      );
    }

    if (disconnectedSlot === -1 || disconnectedSlot === undefined) {
      console.warn("Disconnect de socket não mapeado:", socket.id);
      return;
    }

    const wasGameActive = players[0] !== null && players[1] !== null;

    // Limpa timers pendentes
    if (disconnectionTimers.has(disconnectedSlot)) {
      clearTimeout(disconnectionTimers.get(disconnectedSlot));
      disconnectionTimers.delete(disconnectedSlot);
    }
    if (championSelectionTimers[disconnectedSlot]) {
      clearTimeout(championSelectionTimers[disconnectedSlot]);
      championSelectionTimers[disconnectedSlot] = null;
    }

    // Libera slot
    players[disconnectedSlot] = null;
    connectedSockets.delete(socket.id);
    playerNames.delete(disconnectedSlot);
    playerTeamsSelected[disconnectedSlot] = false;
    playersReadyToEndTurn.delete(disconnectedSlot);
    pendingActions = [];

    const connectedCount = players.filter((p) => p !== null).length;
    io.emit("playerCountUpdate", connectedCount);
    io.emit("playerNamesUpdate", Array.from(playerNames.entries()));

    // Nenhum jogador restante — reset total
    if (connectedCount === 0) {
      resetGameState();
      io.emit("gameStateUpdate", getGameState());
      disconnectionTimers.forEach((timer) => clearTimeout(timer));
      disconnectionTimers.clear();
      return;
    }

    // Um jogador restante com jogo ativo — inicia contagem regressiva
    if (wasGameActive && connectedCount === 1) {
      console.log("PLAYERS:", players);
      console.log("CONNECTED COUNT:", connectedCount);
      const remainingSlot = players[0] ? 0 : 1;
      const remainingSocketId = players[remainingSlot].socketId;

      io.to(remainingSocketId).emit("opponentDisconnected", {
        timeout: DISCONNECT_TIMEOUT,
      });

      const timer = setTimeout(() => {
        io.to(remainingSocketId).emit(
          "forceLogout",
          "Seu oponente se desconectou e não reconectou a tempo.",
        );

        players[remainingSlot] = null;
        connectedSockets.delete(remainingSocketId);
        playerNames.delete(remainingSlot);
        resetGameState();
        io.emit("playerCountUpdate", players.filter((p) => p !== null).length);
        io.emit("playerNamesUpdate", Array.from(playerNames.entries()));
        io.emit("gameStateUpdate", getGameState());
        disconnectionTimers.delete(disconnectedSlot);
      }, DISCONNECT_TIMEOUT);

      disconnectionTimers.set(disconnectedSlot, timer);
    }
  });

  // =============================
  //  selectTeam
  // =============================

  socket.on(
    "selectTeam",
    ({ team: clientTeam, champions: selectedChampionKeys }) => {
      const playerSlot = connectedSockets.get(socket.id);
      const player = players[playerSlot];

      if (!player || player.team !== clientTeam) {
        socket.emit(
          "actionFailed",
          "Você não tem permissão para selecionar campeões para este time.",
        );
        return;
      }

      if (playerTeamsSelected[playerSlot]) {
        socket.emit("actionFailed", "Você já confirmou sua equipe.");
        return;
      }

      player.selectedTeam = selectedChampionKeys;
      playerTeamsSelected[playerSlot] = true;

      startGameIfReady();
    },
  );

  // =============================
  //  removeChampion (edit mode / debug)
  // =============================

  socket.on("removeChampion", ({ championId }) => {
    const playerSlot = connectedSockets.get(socket.id);
    const player = players[playerSlot];
    const championToRemove = activeChampions.get(championId);

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
  //  changeChampionHp (edit mode / debug)
  // =============================

  socket.on("changeChampionHp", ({ championId, amount }) => {
    const playerSlot = connectedSockets.get(socket.id);
    const player = players[playerSlot];
    const champion = activeChampions.get(championId);

    if (!player || !champion || champion.team !== player.team) {
      socket.emit(
        "actionFailed",
        "Você não tem permissão para alterar o HP deste campeão.",
      );
      return;
    }

    const oldHP = champion.HP;
    champion.HP += amount;

    logTurnEvent("hpChanged", {
      championId,
      championName: champion.name,
      oldHP,
      newHP: champion.HP,
      amount,
    });

    if (champion.HP <= 0) {
      removeChampionFromGame(championId, champion.team);
    } else if (amount > 0 && champion.HP > champion.maxHP) {
      champion.maxHP += amount;
    }

    io.emit("gameStateUpdate", getGameState());
  });

  // =============================
  //  changeChampionStat (edit mode / debug)
  // =============================

  socket.on("changeChampionStat", ({ championId, stat, action }) => {
    const playerSlot = connectedSockets.get(socket.id);
    const player = players[playerSlot];
    const champion = activeChampions.get(championId);

    if (!player || !champion || champion.team !== player.team) {
      socket.emit(
        "actionFailed",
        "Você não tem permissão para alterar os stats deste campeão.",
      );
      return;
    }

    const statSteps = { Attack: 5, Defense: 5, Speed: 5, Critical: 1 };
    const step = statSteps[stat] || 5;
    const delta = action === "up" ? step : -step;
    const oldValue = champion[stat];

    if (stat in champion) {
      champion[stat] += delta;
      if (champion[stat] < 0) champion[stat] = 0;

      logTurnEvent("statChanged", {
        championId,
        championName: champion.name,
        stat,
        oldValue,
        newValue: champion[stat],
        delta,
      });
    }

    io.emit("gameStateUpdate", getGameState());
  });

  // =============================
  //  requestSkillUse → skillApproved / skillDenied
  // =============================

  socket.on("requestSkillUse", ({ userId, skillKey }) => {
    const playerSlot = connectedSockets.get(socket.id);
    const player = players[playerSlot];
    const user = activeChampions.get(userId);

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
  //  useSkill (enfileira ação pendente)
  // =============================

  socket.on("useSkill", ({ userId, skillKey, targetIds }) => {
    const playerSlot = connectedSockets.get(socket.id);
    const player = players[playerSlot];
    const user = activeChampions.get(userId);

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

    pendingActions.push({
      championId: userId,
      skillKey,
      targetIds,
      priority: skill.priority || 0,
      speed: user.Speed,
      turn: currentTurn,
      ultCost: cost,
    });

    io.to(socket.id).emit(
      "combatLog",
      `${formatChampionName(user)} usou ${skill.name}. Ação pendente.`,
    );
  });

  // =============================
  //  surrender (Render-se)
  // =============================

  socket.on("surrender", () => {
    if (gameEnded) return;

    const playerSlot = connectedSockets.get(socket.id);
    if (playerSlot === undefined) return;

    const player = players[playerSlot];
    if (!player) return;

    const surrenderingTeam = player.team;
    const winnerTeam = surrenderingTeam === 1 ? 2 : 1;
    const winnerSlot = winnerTeam - 1;
    const winnerName = playerNames.get(winnerSlot);
    const surrendererName = playerNames.get(playerSlot);

    gameEnded = true;

    // Set score to max for the winner
    playerScores[winnerSlot] = MAX_SCORE;
    io.emit("scoreUpdate", {
      player1: playerScores[0],
      player2: playerScores[1],
    });

    io.emit("gameOver", {
      winnerTeam,
      winnerName,
    });
  });

  // =============================
  //  endTurn
  // =============================

  socket.on("endTurn", () => {
    if (gameEnded) {
      socket.emit("actionFailed", "O jogo já terminou.");
      return;
    }

    const playerSlot = connectedSockets.get(socket.id);
    if (playerSlot === undefined) {
      socket.emit(
        "actionFailed",
        "Você não está em um slot de jogador válido.",
      );
      return;
    }

    playersReadyToEndTurn.add(playerSlot);
    io.emit("playerConfirmedEndTurn", playerSlot);

    if (playersReadyToEndTurn.size === 2) {
      // Valida se ambos ainda estão conectados
      if (players[0] === null || players[1] === null) {
        playersReadyToEndTurn.clear();
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
