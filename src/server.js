// ============================================================
//  HELPERS DE MANIPULAÇÃO DE RECURSOS
// ============================================================

/**
 * Retorna info do recurso do campeão: { isEnergy, current, type, key }
 */
function getChampionResourceInfo(champion) {
  const isEnergy = champion.energy !== undefined;
  return {
    isEnergy,
    current: isEnergy
      ? Number(champion.energy ?? 0)
      : Number(champion.mana ?? 0),
    type: isEnergy ? "energy" : "mana",
    key: isEnergy ? "energy" : "mana",
  };
}

/**
 * Calcula o custo de uma skill para o campeão
 */
function getSkillCost(champion, skill) {
  const { isEnergy } = getChampionResourceInfo(champion);
  if (!skill) return 0;
  if (Number.isFinite(Number(skill.cost)))
    return Math.max(0, Number(skill.cost));
  if (isEnergy && Number.isFinite(skill.energyCost))
    return Math.max(0, skill.energyCost);
  if (!isEnergy && Number.isFinite(skill.manaCost))
    return Math.max(0, skill.manaCost);
  return 0;
}

/**
 * Restaura recurso do campeão.
 */
function restoreChampionResource(champion, amount) {
  return champion.applyResourceChange({
    amount: Math.max(0, Number(amount) || 0),
    mode: "add",
  }).applied;
}

/**
 * Aplica regeneração de recurso (com multiplicadores/flat) e retorna quanto regenerou.
 */
function applyGlobalTurnRegen(champion, context) {
  if (!champion) return 0;

  const BASE_REGEN = 75;

  const result = champion.applyResourceChange({
    amount: BASE_REGEN,
    mode: "add",
  });

  const applied = result.applied;

  if (applied > 0) {
    const isEnergy = champion.energy !== undefined;
    const resourceType = isEnergy ? "energy" : "mana";

    context.resourceEvents = context.resourceEvents || [];
    context.resourceEvents.push({
      type: "resourceGain",
      targetId: champion.id,
      amount: applied,
      resourceType,
    });
  }

  return applied;
}

/**
 * Helper para snapshot do recurso
 */
function getChampionResourceSnapshot(champion) {
  return getChampionResourceInfo(champion).current;
}

/**
 * Reembolso de recurso (ex: ação negada)
 */
function refundActionResource(user, action) {
  if (!user || !action) return;
  const amount = Number(action.resourceCost) || 0;
  if (amount > 0) {
    restoreChampionResource(user, amount);
  }
}
// ============================================================
//  IMPORTS
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import { championDB } from "../shared/data/championDB.js";
import { Champion } from "../shared/core/Champion.js";
import { generateId } from "../shared/core/id.js";
import {
  formatChampionName,
  formatPlayerName,
} from "../shared/core/formatters.js";
import { emitCombatEvent } from "../shared/core/combatEvents.js";

// ============================================================
//  CONFIGURAÇÃO
// ============================================================

const editMode = {
  enabled: true,
  autoLogin: false,
  autoSelection: false,
  actMultipleTimesPerTurn: false,
  unreleasedChampions: false,
  damageOutput: null, // Valor fixo de dano para testes (ex: 999). null = desativado. (SERVER-ONLY)
  alwaysCrit: false, // Força crítico em todo ataque. (SERVER-ONLY)
};

const TEAM_SIZE = 3;
const MAX_SCORE = 2; // Melhor de 3 — primeiro a 2 vence
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

  // Aguarda animação de morte e traz reserva
  setTimeout(() => {
    const activeInTeam = Array.from(activeChampions.values()).filter(
      (c) => c.team === playerTeam,
    ).length;

    const slot = playerTeam - 1;
    const player = players[slot];

    if (activeInTeam < 2 && player?.backChampion) {
      assignChampionsToTeam(playerTeam, [player.backChampion]);
      player.backChampion = null;
      io.emit("backChampionUpdate", {
        team: playerTeam,
        championKey: null,
      });
    }

    io.emit("gameStateUpdate", getGameState());
  }, SERVER_DELAY_AFTER_ANIMATION + CLIENT_DEATH_ANIMATION_DURATION);
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

  // Keywords bloqueantes completas
  if (user.hasKeyword?.("paralisado")) {
    socket.emit("skillDenied", `${user.name} está Paralisado e não pode agir!`);
    return false;
  }

  if (user.hasKeyword?.("atordoado")) {
    socket.emit("skillDenied", `${user.name} está Atordoado e não pode agir!`);
    return false;
  }

  // Inerte — pode ser interrompido por ação se permitido
  if (user.hasKeyword?.("inerte")) {
    const k = user.getKeyword("inerte");

    if (k?.canBeInterruptedByAction) {
      user.removeKeyword("inerte");
      io.emit(
        "combatLog",
        `O efeito "Inerte" de ${formatChampionName(user)} foi interrompido!`,
      );
      return true;
    }

    socket.emit("skillDenied", `${user.name} está Inerte e não pode agir!`);
    return false;
  }

  // Enraizado bloqueia apenas habilidades de contato
  if (user.hasKeyword?.("enraizado") && skill.contact) {
    socket.emit(
      "skillDenied",
      `${user.name} está Enraizado e não pode usar habilidades de contato!`,
    );
    return false;
  }

  return true;
}

/**
 * Valida se o campeão pode EXECUTAR a ação no momento da resolução do turno.
 * Diferente de validateActionIntent — aqui o estado pode ter mudado.
 */
function canExecuteAction(user, action) {
  const userName = formatChampionName(user);
  if (!user || !user.alive) {
    return false;
  }

  // Keywords bloqueantes
  const blockingKeywords = [
    ["paralisado", "Paralisado"],
    ["atordoado", "Atordoado"],
    ["congelado", "Congelado"],
  ];

  for (const [key, label] of blockingKeywords) {
    if (user.hasKeyword?.(key)) {
      io.emit(
        "combatLog",
        `${userName} tentou agir mas estava ${label}! Ação cancelada.`,
      );
      return false;
    }
  }

  // Inerte — tratamento especial
  if (user.hasKeyword?.("inerte")) {
    const k = user.getKeyword("inerte");

    if (!k?.canBeInterruptedByAction) {
      io.emit(
        "combatLog",
        `${userName} tentou agir mas estava Inerte! Ação cancelada.`,
      );
      return false;
    }

    user.removeKeyword("inerte");
    io.emit("combatLog", `O efeito "Inerte" de ${userName} foi interrompido!`);
  }

  return true;
}

// ============================================================
//  RESOLUÇÃO DE ALVOS
// ============================================================

/** Resolve os alvos de uma ação, respeitando Provoke e validando existência. */
function resolveSkillTargets(user, skill, action) {
  const currentTargets = {};
  let redirected = false;

  // --- PROVOKE ---
  if (user.provokeEffects.length > 0 && skill.targetSpec.includes("enemy")) {
    const provokerId = user.provokeEffects[0].provokerId;
    const provoker = activeChampions.get(provokerId);

    if (provoker && provoker.alive) {
      for (const role in action.targetIds) {
        const original = activeChampions.get(action.targetIds[role]);
        if (original && original.alive && original.team !== user.team) {
          currentTargets[role] = provoker;
          redirected = true;
        } else if (role === "self") {
          currentTargets[role] = user;
        } else if (original && original.alive) {
          currentTargets[role] = original;
        }
        // Alvo morto → não entra, a porção da skill correspondente é ignorada
      }

      if (redirected) {
        io.emit(
          "combatLog",
          `${formatChampionName(user)} foi provocado e redirecionou seu ataque para ${formatChampionName(provoker)}!`,
        );
      }
    } else {
      io.emit(
        "combatLog",
        `O provocador de ${formatChampionName(user)} não está ativo. A provocação é ignorada.`,
      );
    }
  }

  // --- Resolução normal ---
  if (!redirected) {
    // Verifica se a skill possui alvos globais (all-enemies, all-allies, all)
    const normalizedSpec = Array.isArray(skill.targetSpec)
      ? skill.targetSpec.map((s) => (typeof s === "string" ? s : s.type))
      : [];

    const hasAllEnemies = normalizedSpec.includes("all-enemies");
    const hasAllAllies = normalizedSpec.includes("all-allies");
    const hasAll = normalizedSpec.includes("all");

    if (hasAllEnemies || hasAllAllies || hasAll) {
      // Alvos globais — resolvidos automaticamente pelo servidor
      if (hasAllEnemies || hasAll) {
        const enemies = Array.from(activeChampions.values()).filter(
          (c) => c.team !== user.team && c.alive,
        );
        enemies.forEach((e, i) => {
          const key = i === 0 ? "enemy" : `enemy${i + 1}`;
          currentTargets[key] = e;
        });
      }
      if (hasAllAllies || hasAll) {
        const allies = Array.from(activeChampions.values()).filter(
          (c) => c.team === user.team && c.alive,
        );
        allies.forEach((a, i) => {
          const key = i === 0 ? "ally" : `ally${i + 1}`;
          currentTargets[key] = a;
        });
      }
    } else {
      // Alvos manuais — enviados pelo client via targetIds
      for (const role in action.targetIds) {
        const target = activeChampions.get(action.targetIds[role]);

        if (target && target.alive) {
          currentTargets[role] = target;
        } else if (role === "self") {
          // "self" sempre resolve para o próprio user
          currentTargets[role] = user;
        }
        // Alvo morto/inválido → simplesmente não entra em currentTargets.
        // A porção da skill referente a esse alvo não será executada,
        // mas as demais porções continuam normalmente.
      }
    }

    // Se nenhum alvo restou, aí sim cancela a ação
    if (Object.keys(currentTargets).length === 0) {
      io.emit(
        "combatLog",
        `Nenhum alvo válido para a ação de ${formatChampionName(user)}. Ação cancelada.`,
      );
      return null;
    }
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
function extractEffectsFromResult(result) {
  const effects = [];
  if (!result || typeof result !== "object") return effects;

  const getNameById = (id) =>
    id ? activeChampions.get(id)?.name || null : null;

  // Evasão — se evadiu, não há dano nem heal
  if (result.evaded && result.targetId) {
    effects.push({
      type: "evasion",
      targetId: result.targetId,
      sourceId: result.userId,
      targetName: getNameById(result.targetId),
      sourceName: getNameById(result.userId),
    });
    return effects;
  }

  // Imunidade absoluta — totalDamage 0, log menciona imunidade
  if (
    result.totalDamage === 0 &&
    !result.evaded &&
    result.log?.includes("Imunidade Absoluta")
  ) {
    effects.push({
      type: "immune",
      targetId: result.targetId,
      sourceId: result.userId,
      targetName: getNameById(result.targetId),
      sourceName: getNameById(result.userId),
    });
    return effects;
  }

  // Bloqueio por escudo — totalDamage 0, log menciona bloqueio
  if (
    result.totalDamage === 0 &&
    !result.evaded &&
    result.log?.includes("bloqueou completamente")
  ) {
    effects.push({
      type: "shieldBlock",
      targetId: result.targetId,
      sourceId: result.userId,
      targetName: getNameById(result.targetId),
      sourceName: getNameById(result.userId),
    });
    return effects;
  }

  // Dano
  if (result.totalDamage > 0 && result.targetId) {
    effects.push({
      type: "damage",
      targetId: result.targetId,
      sourceId: result.userId,
      amount: result.totalDamage,
      isCritical: result.crit?.didCrit || false,
      targetName: getNameById(result.targetId),
      sourceName: getNameById(result.userId),
    });
  }

  // Heal direto do resultado (lifesteal)
  if (result.heal && result.heal.amount > 0 && result.heal.targetId) {
    effects.push({
      type: "heal",
      targetId: result.heal.targetId,
      sourceId: result.heal.sourceId || result.userId,
      amount: result.heal.amount,
      targetName: getNameById(result.heal.targetId),
      sourceName: getNameById(result.heal.sourceId || result.userId),
    });
  }

  return effects;
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

/** Executa a habilidade, emite payloads e registra no histórico. */
function performSkillExecution(
  user,
  skill,
  targets,
  actionResourceCost = 0,
  actionResourceSnapshot = null,
) {
  const aliveChampionsArray = [...activeChampions.values()].filter(
    (c) => c.alive,
  );

  // Contexto compartilhado para a execução da skill
  const context = {
    currentTurn,
    editMode, // Injetado pelo server — única fonte de verdade para damageOutput
    allChampions: activeChampions,
    aliveChampions: aliveChampionsArray,
    healEvents: [],
    healSourceId: user.id,
    buffEvents: [],
    buffSourceId: user.id,
    resourceEvents: [],
    registerHeal({ target, amount, sourceId } = {}) {
      const healAmount = Number(amount) || 0;
      if (!target?.id || healAmount <= 0) return;
      this.healEvents.push({
        type: "heal",
        targetId: target.id,
        sourceId: sourceId || this.healSourceId || target.id,
        amount: healAmount,
      });
    },
    registerBuff({ target, amount, statName, sourceId } = {}) {
      const buffAmount = Number(amount) || 0;
      if (!target?.id || buffAmount <= 0) return;
      this.buffEvents.push({
        type: "buff",
        targetId: target.id,
        sourceId: sourceId || this.buffSourceId || target.id,
        amount: buffAmount,
        statName,
      });
    },
    shieldEvents: [],
    registerShield({ target, amount, sourceId } = {}) {
      const shieldAmount = Number(amount) || 0;
      if (!target?.id || shieldAmount <= 0) return;
      this.shieldEvents.push({
        type: "shield",
        targetId: target.id,
        sourceId: sourceId || user.id,
        amount: shieldAmount,
      });
    },
    registerResourceChange({ target, amount, sourceId } = {}) {
      const normalizedAmount = Number(amount) || 0;
      if (!target?.id || normalizedAmount === 0) return 0;
      const isEnergy = target.energy !== undefined;
      let applied = 0;
      if (normalizedAmount > 0) {
        const result = target.applyResourceChange({
          amount: normalizedAmount,
          mode: "add",
        });
        applied = result.applied;
      } else {
        const current = isEnergy
          ? Number(target.energy ?? 0)
          : Number(target.mana ?? 0);
        const spend = Math.min(current, Math.abs(normalizedAmount));
        if (spend <= 0) return 0;
        if (isEnergy) target.energy = Math.max(0, current - spend);
        else target.mana = Math.max(0, current - spend);
        applied = -spend;
      }
      if (applied === 0) return 0;
      this.resourceEvents.push({
        type: applied > 0 ? "resourceGain" : "resourceSpend",
        targetId: target.id,
        sourceId: sourceId || user.id,
        amount: Math.abs(applied),
        resourceType: isEnergy ? "energy" : "mana",
      });
      return applied;
    },
  };

  // Injeta contexto em todos os campeões (skills podem acessar aliados/inimigos)
  activeChampions.forEach((champion) => {
    champion.runtime = champion.runtime || {};
    champion.runtime.currentContext = context;
  });

  context.currentSkill = skill; // Injeta skill atual no contexto (para checks de Escudo de Feitiço)
  const result = skill.execute({ user, targets, context });

  // Limpa contexto
  activeChampions.forEach((champion) => {
    if (champion.runtime) delete champion.runtime.currentContext;
  });

  // --- Registro no histórico ---
  logTurnEvent("skillUsed", {
    championId: user.id,
    championName: user.name,
    skillKey: skill.key,
    skillName: skill.name,
    targetIds: Object.fromEntries(
      Object.entries(targets).map(([k, v]) => [k, v.id]),
    ),
    targetNames: Object.values(targets).map((t) => t.name),
  });

  const turnData = ensureTurnEntry();
  if (!turnData.skillsUsedThisTurn[user.id]) {
    turnData.skillsUsedThisTurn[user.id] = [];
  }
  turnData.skillsUsedThisTurn[user.id].push(skill.key);

  // --- Montagem do envelope de combate (v2) ---
  const results = Array.isArray(result) ? result : result ? [result] : [];
  const effects = [];
  const affectedIds = new Set();
  affectedIds.add(user.id);

  if (actionResourceCost > 0) {
    const isEnergy = user.energy !== undefined;
    effects.push({
      type: "resourceSpend",
      targetId: user.id,
      sourceId: user.id,
      amount: actionResourceCost,
      resourceType: isEnergy ? "energy" : "mana",
      targetName: user.name,
      sourceName: user.name,
    });
  }

  // 1. Extrair efeitos de cada resultado
  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    effects.push(...extractEffectsFromResult(entry));
    if (entry.targetId) affectedIds.add(entry.targetId);
    if (entry.userId) affectedIds.add(entry.userId);
    if (entry.heal?.targetId) affectedIds.add(entry.heal.targetId);
  }

  // 1.1. Regeneracao por dano (uma vez por acao que causou dano)
  const didDealDamage = results.some(
    (entry) => entry?.userId === user.id && entry.totalDamage > 0,
  );

  if (didDealDamage) {
    const isEnergy = user.energy !== undefined;
    const baseValue = Number.isFinite(user.resourceBase)
      ? user.resourceBase
      : isEnergy
        ? Number(user.energy ?? 0)
        : Number(user.mana ?? 0);
    const currentValue = Number.isFinite(actionResourceSnapshot)
      ? actionResourceSnapshot
      : isEnergy
        ? Number(user.energy ?? 0)
        : Number(user.mana ?? 0);
    const rawRegen = baseValue * 0.05 + currentValue * 0.05;
    const mult = Number.isFinite(user.runtime?.resourceRegenMultiplier)
      ? user.runtime.resourceRegenMultiplier
      : 1;
    const flat = Number.isFinite(user.runtime?.resourceRegenFlatBonus)
      ? user.runtime.resourceRegenFlatBonus
      : 0;
    const modifiedRegen = rawRegen * mult + flat;
    const regenAmount = user.roundToFive
      ? user.roundToFive(modifiedRegen)
      : Math.round(modifiedRegen / 5) * 5;
    if (regenAmount > 0) {
      const result = user.applyResourceChange({
        amount: regenAmount,
        mode: "add",
      });
      const restored = result.applied;
      if (restored > 0) {
        effects.push({
          type: "resourceGain",
          targetId: user.id,
          sourceId: user.id,
          amount: restored,
          resourceType: isEnergy ? "energy" : "mana",
          targetName: user.name,
          sourceName: user.name,
        });
        affectedIds.add(user.id);
      }
    }
  }

  // 2. Anexar heals do contexto (curas indiretas, passivas)
  for (const h of context.healEvents) {
    effects.push({
      type: "heal",
      targetId: h.targetId,
      sourceId: h.sourceId,
      amount: h.amount,
      targetName: activeChampions.get(h.targetId)?.name || null,
      sourceName: activeChampions.get(h.sourceId)?.name || null,
    });
    affectedIds.add(h.targetId);
  }

  // 3. Anexar shields do contexto
  for (const s of context.shieldEvents) {
    effects.push({
      type: "shield",
      targetId: s.targetId,
      sourceId: s.sourceId,
      amount: s.amount,
      targetName: activeChampions.get(s.targetId)?.name || null,
      sourceName: activeChampions.get(s.sourceId)?.name || null,
    });
    affectedIds.add(s.targetId);
  }

  // 4. Anexar buffs do contexto
  for (const b of context.buffEvents) {
    effects.push({
      type: "buff",
      targetId: b.targetId,
      sourceId: b.sourceId,
      amount: b.amount,
      statName: b.statName,
      targetName: activeChampions.get(b.targetId)?.name || null,
      sourceName: activeChampions.get(b.sourceId)?.name || null,
    });
    affectedIds.add(b.targetId);
  }

  // 5. Anexar mudanças de recurso do contexto
  for (const r of context.resourceEvents) {
    effects.push({
      type: r.type,
      targetId: r.targetId,
      sourceId: r.sourceId,
      amount: r.amount,
      resourceType: r.resourceType,
      targetName: activeChampions.get(r.targetId)?.name || null,
      sourceName: activeChampions.get(r.sourceId)?.name || null,
    });
    affectedIds.add(r.targetId);
  }

  // 6. Montar log verboso
  const logParts = results.map((r) => r?.log).filter(Boolean);
  const log = logParts.length > 0 ? logParts.join("\n") : null;

  // 7. Snapshot do estado final de todos os campeões afetados
  const state = snapshotChampions([...affectedIds]);

  // 8. Info da ação (skill usada)
  const primaryTarget = Object.values(targets || {})[0] || null;

  emitCombatAction({
    action: {
      userId: user.id,
      userName: user.name,
      skillKey: skill.key,
      skillName: skill.name,
      targetId: primaryTarget?.id || null,
      targetName: primaryTarget?.name || null,
    },
    effects,
    log,
    state,
  });

  // Remove Epifania ao agir
  if (user.hasKeyword?.("epifania_ativa")) {
    user.removeKeyword("epifania_ativa");
    user.removeDamageReductionBySource?.("epifania");
    user.removeKeyword("imunidade absoluta");
    io.emit(
      "combatLog",
      `${formatChampionName(user)} deixou o Limiar da Existência.`,
    );
  }
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

  const targets = resolveSkillTargets(user, skill, action);
  if (!targets) {
    refundActionResource(user, action);
    return false;
  }

  performSkillExecution(
    user,
    skill,
    targets,
    action.resourceCost,
    action.resourceSnapshot,
  );
  return true;
}

// ============================================================
//  RESOLUÇÃO DE TURNOS
// ============================================================

/** Ordena e executa todas as ações pendentes (prioridade > velocidade > desempate). */
function resolveSkillActions() {
  pendingActions.forEach((a) => {
    a._tieBreaker = Math.random();
  });

  pendingActions.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.speed !== a.speed) return b.speed - a.speed;
    return b._tieBreaker - a._tieBreaker;
  });

  for (const action of pendingActions) {
    executeSkillAction(action);
  }

  pendingActions = [];
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

    emitCombatAction({
      action: null,
      effects: [{ type: "gameOver", winnerTeam, winnerName }],
      log: `Fim de jogo! ${formatPlayerName(winnerName, winnerTeam)} venceu a partida!`,
      state: null,
    });
  }
}

/** Pipeline completo de finalização do turno. */
function handleEndTurn() {
  // 1. Resolver ações pendentes
  resolveSkillActions();

  // 2. Processar mortes
  processChampionsDeaths();

  // 3. Avançar turno
  currentTurn++;
  playersReadyToEndTurn.clear();

  // 4. Preparar contexto único de início de turno
  const aliveChampionsArray = [...activeChampions.values()].filter(
    (c) => c.alive,
  );

  const turnStartContext = {
    currentTurn,
    editMode,
    allChampions: activeChampions,
    aliveChampions: aliveChampionsArray,
    healEvents: [],
    buffEvents: [],
    resourceEvents: [],
    buffSourceId: null,

    registerHeal({ target, amount, sourceId } = {}) {
      const healAmount = Number(amount) || 0;
      if (!target?.id || healAmount <= 0) return;

      turnStartContext.healEvents.push({
        type: "heal",
        targetId: target.id,
        sourceId: sourceId || target.id,
        amount: healAmount,
      });
    },

    registerBuff({ target, amount, statName, sourceId } = {}) {
      const buffAmount = Number(amount) || 0;
      if (!target?.id || buffAmount <= 0) return;

      turnStartContext.buffEvents.push({
        type: "buff",
        targetId: target.id,
        sourceId: sourceId || turnStartContext.buffSourceId || target.id,
        amount: buffAmount,
        statName,
      });
    },
  };

  // ✅ 5. Regen global via helper
  activeChampions.forEach((champion) => {
    applyGlobalTurnRegen(champion, turnStartContext);
  });

  // 6. Injetar contexto nas passivas
  activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    champ.runtime = champ.runtime || {};
    champ.runtime.currentContext = turnStartContext;
  });

  const turnStartResults = emitCombatEvent(
    "onTurnStart",
    { context: turnStartContext },
    activeChampions,
  );
  // 7. Limpar referência temporária
  activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  // 8. Consolidar efeitos
  const turnStartLogs =
    turnStartResults?.map((r) => r?.log).filter(Boolean) || [];

  const turnStartHealEffects = turnStartContext.healEvents.map((h) => ({
    type: "heal",
    targetId: h.targetId,
    sourceId: h.sourceId,
    amount: h.amount,
  }));

  const turnStartBuffEffects = turnStartContext.buffEvents.map((b) => ({
    type: "buff",
    targetId: b.targetId,
    sourceId: b.sourceId,
    amount: b.amount,
    statName: b.statName,
  }));

  const allTurnStartEffects = [
    ...turnStartHealEffects,
    ...turnStartBuffEffects,
    ...turnStartContext.resourceEvents,
  ];

  if (turnStartLogs.length > 0 || allTurnStartEffects.length > 0) {
    const affectedIds = [
      ...new Set(allTurnStartEffects.map((e) => e.targetId)),
    ];

    emitCombatAction({
      action: null,
      effects: allTurnStartEffects,
      log: turnStartLogs.join("\n") || null,
      state: affectedIds.length > 0 ? snapshotChampions(affectedIds) : null,
    });
  }

  // 9. Limpar modificadores de stats expirados
  const revertedStats = [];
  activeChampions.forEach((champion) => {
    const expired = champion.purgeExpiredStatModifiers(currentTurn);
    if (expired.length > 0) revertedStats.push(...expired);
  });

  // 10. Limpar keywords expiradas
  activeChampions.forEach((champion) => {
    const expiredKeywords = champion.purgeExpiredKeywords(currentTurn);
    if (expiredKeywords.length > 0) {
      expiredKeywords.forEach((keyword) => {
        io.emit(
          "combatLog",
          `Efeito "${keyword}" expirou para ${formatChampionName(champion)}.`,
        );
      });
    }
  });

  // 11. Emitir atualizações
  io.emit("turnUpdate", currentTurn);
  if (revertedStats.length > 0) io.emit("statsReverted", revertedStats);
  io.emit("gameStateUpdate", getGameState());
}

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
  playerTeamsSelected = [false, false];
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

io.on("connection", (socket) => {
  console.log("Um usuário conectado:", socket.id);

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
    const finalUsername = editMode.enabled ? `Player${slot + 1}` : username;

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
    if (!editMode.autoSelection) {
      handleChampionSelection();
      return;
    }

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
      activeChampions.clear();
      assignChampionsToTeam(
        players[0].team,
        players[0].selectedTeam.slice(0, 2),
      );
      assignChampionsToTeam(
        players[1].team,
        players[1].selectedTeam.slice(0, 2),
      );
      io.emit("gameStateUpdate", getGameState());
    }
  }

  // =============================
  //  requestPlayerSlot
  // =============================

  socket.on("requestPlayerSlot", (username) => {
    const assignResult = assignPlayerSlot(username);
    if (!assignResult) return;

    const { playerSlot, finalUsername } = assignResult;
    // Envia editMode ao client SEM propriedades server-only (damageOutput, alwaysCrit, etc.)
    const { damageOutput, alwaysCrit, ...clientEditMode } = editMode;
    socket.emit("editModeUpdate", clientEditMode);

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
    if (editMode.enabled) {
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

  // =============================
  //  disconnect
  // =============================

  socket.on("disconnect", () => {
    const disconnectedSlot = connectedSockets.get(socket.id);
    if (disconnectedSlot === undefined) return;

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

      // Valida e preenche slots vazios com campeões aleatórios
      let finalTeam = [...selectedChampionKeys];
      const allChampionKeys = Object.keys(championDB);

      for (let i = 0; i < TEAM_SIZE; i++) {
        if (finalTeam[i] && allChampionKeys.includes(finalTeam[i])) continue;

        let randomChamp;
        do {
          randomChamp = getRandomChampionKey();
        } while (randomChamp && finalTeam.includes(randomChamp));

        finalTeam[i] = randomChamp || Object.keys(championDB)[0];
      }

      player.selectedTeam = finalTeam;
      playerTeamsSelected[playerSlot] = true;

      if (championSelectionTimers[playerSlot]) {
        clearTimeout(championSelectionTimers[playerSlot]);
        championSelectionTimers[playerSlot] = null;
      }

      // Ambos selecionaram — iniciar jogo
      if (checkAllTeamsSelected()) {
        activeChampions.clear();
        currentTurn = 1;
        turnHistory.clear();
        playerScores = [0, 0];
        gameEnded = false;
        io.emit("scoreUpdate", {
          player1: playerScores[0],
          player2: playerScores[1],
        });

        // Implanta campeões na arena
        assignChampionsToTeam(
          players[0].team,
          players[0].selectedTeam.slice(0, 2),
        );
        assignChampionsToTeam(
          players[1].team,
          players[1].selectedTeam.slice(0, 2),
        );
        assignChampionsToTeam(
          players[0].team,
          players[0].selectedTeam.slice(2, 3),
        );
        assignChampionsToTeam(
          players[1].team,
          players[1].selectedTeam.slice(2, 3),
        );

        io.emit("gameStateUpdate", getGameState());
        io.emit("backChampionUpdate", {
          team: players[0].team,
          championKey: players[0].backChampion,
        });
        io.emit("backChampionUpdate", {
          team: players[1].team,
          championKey: players[1].backChampion,
        });
      } else {
        socket.emit(
          "teamSelectionConfirmed",
          "Equipe confirmada! Aguardando o outro jogador...",
        );
      }
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

    const cost = getSkillCost(user, skill);
    const { isEnergy, current } = getChampionResourceInfo(user);
    if (cost > current) {
      const label = isEnergy ? "EN" : "MP";
      return socket.emit("skillDenied", `${label} insuficiente.`);
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
      socket.emit(
        "actionFailed",
        "Você não tem permissão para usar habilidades com este campeão.",
      );
      return;
    }

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) {
      socket.emit("actionFailed", "Habilidade não encontrada.");
      return;
    }

    const cost = getSkillCost(user, skill);
    const { isEnergy, current } = getChampionResourceInfo(user);
    if (!user.spendResource(cost)) {
      const label = isEnergy ? "EN" : "MP";
      socket.emit("actionFailed", `${label} insuficiente.`);
      return;
    }
    const resourceSnapshot = current;

    // Valida alvos
    const targets = {};
    for (const role in targetIds) {
      targets[role] = activeChampions.get(targetIds[role]);
      if (!targets[role]) {
        socket.emit("actionFailed", `Alvo inválido para a função ${role}.`);
        return;
      }
    }

    pendingActions.push({
      championId: userId,
      skillKey,
      targetIds,
      priority: skill.priority || 0,
      speed: user.Speed,
      turn: currentTurn,
      resourceCost: cost,
      resourceSnapshot,
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

    emitCombatAction({
      action: null,
      effects: [{ type: "gameOver", winnerTeam, winnerName }],
      log: `${formatPlayerName(surrendererName, surrenderingTeam)} se rendeu! ${formatPlayerName(winnerName, winnerTeam)} venceu a partida!`,
      state: null,
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
