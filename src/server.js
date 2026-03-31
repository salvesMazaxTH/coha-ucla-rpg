// ============================================================
//  IMPORTS
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path, { format } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { GameMatch } from "../shared/engine/match/GameMatch.js";
import { Player } from "../shared/engine/match/Player.js";

import { championDB } from "../shared/data/championDB.js";
import { Champion } from "../shared/core/Champion.js";
import { generateId } from "../shared/utils/id.js";
import {
  formatChampionName,
  formatPlayerName,
} from "../shared/ui/formatters.js";
import { emitCombatEvent } from "../shared/engine/combat/combatEvents.js";
import { Action } from "../shared/engine/combat/Action.js";
import { TurnResolver } from "../shared/engine/combat/TurnResolver.js";
import { DamageEvent } from "../shared/engine/combat/DamageEvent.js";
import { snapshotChampions } from "../shared/engine/combat/snapshotChampions.js";

// ============================================================
//  CONFIGURAÇÃO
// ============================================================

const editMode = {
  enabled: true,
  autoLogin: true,
  autoSelection: false, // Seleção automática de campeões (sem tela de seleção)
  actMultipleTimesPerTurn: false,
  unavailableChampions: true,
  damageOutput: null, // Valor fixo de dano para testes (ex: 999). null = desativado. (SERVER-ONLY)
  alwaysCrit: false, // Força crítico em todo ataque. (SERVER-ONLY)
  alwaysEvade: false, // Força evasão em todo ataque. (SERVER-ONLY)
  executionOverride: null, // null = normal
  // number = força threshold (ex: 1 = 100%, 0.5 = 50%)
  freeCostSkills: true, // Habilidades não consomem recurso. (SERVER-ONLY)
};

const TEAM_SIZE = 3;
const ACTIVE_PER_TEAM = 3; // máximo de campeões simultâneos em campo por time
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
let waitingForAnimations = false;

// Fila de reserva por time: team (1 ou 2) → array de championKeys ainda não spawnados

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

function getGameState(extraChampions = []) {
  const champions = Array.from(match.combat.activeChampions.values()).map((c) =>
    c.serialize(),
  );

  // Garantir que campeões extras (ex: recém-mortos) estejam no payload se o frontend ainda os vir como ativos
  for (const extra of extraChampions) {
    if (extra && !champions.find((c) => c.id === extra.id)) {
      champions.push(extra.serialize());
    }
  }

  return {
    champions,
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

/**
 * Cria, registra e (opcionalmente) notifica os clientes de um novo campeão.
 *
 * @param {Object}  opts
 * @param {string}  opts.championKey   – chave no championDB
 * @param {number}  opts.team          – 1 ou 2
 * @param {number|null}  [opts.combatSlot]  – slot explícito; se omitido, encontra o próximo livre
 * @param {boolean} [opts.trackSnapshot=true]  – se registra no combatSnapshot (false na montagem inicial)
 * @param {boolean} [opts.emit=false]          – se emite "championAdded" para os clientes
 * @returns {Champion|null} a instância criada, ou null se impossível (time cheio ou dados inválidos)
 */
function spawnChampion({
  championKey,
  team,
  combatSlot = null,
  trackSnapshot = true,
} = {}) {
  const baseData = championDB[championKey];
  if (!baseData) return null;

  // --- Checar se o time pode receber mais um campeão vivo ---
  if (!match.combat.canSpawnOnTeam(team, ACTIVE_PER_TEAM)) return null;

  // --- Resolver combatSlot ---
  if (!Number.isInteger(combatSlot)) {
    combatSlot = match.combat.getNextAvailableSlot(team, ACTIVE_PER_TEAM);
    if (combatSlot === null) return null; // sem slot livre
  }

  const id = generateId(championKey);

  const newChampion = Champion.fromBaseData(baseData, id, team, {
    combatSlot,
  });

  function applySeasonalSkin(champion) {
    const chance = 0.675;
    const roll = Math.random();
    console.log(`[SKIN CHECK] Rolagem para ${champion.name}: ${roll.toFixed(3)} (chance: ${chance}). roll < chance? ${roll < chance}`);
    if (roll > chance) return;

    const basePath = champion.portrait;

    const fileName = basePath.split("/").pop();
    if (!fileName) return;

    const baseName = fileName.replace(".webp", "");

    const winterPath = `/assets/portraits/${baseName}_curtindo_o_inverno.webp`;

    // caminho físico no disco (ajusta se necessário)
    const absolutePath = path.join(
      process.cwd(),
      "public",
      "assets",
      "portraits",
      `${baseName}_curtindo_o_inverno.webp`,
    );

    // 👇 só aplica se existir
    if (fs.existsSync(absolutePath)) {
      champion.portrait = winterPath;
    }
  }

  applySeasonalSkin(newChampion);

  newChampion.championKey = championKey;
  /* console.log(
    `[SPAWN] ${newChampion.name} (ID: ${id}) no time ${team}, no slot ${combatSlot}, com championKey ${championKey}`,
  ); */

  match.combat.registerChampion(newChampion, { trackSnapshot });

  if (!trackSnapshot) {
    // Montagem inicial — snapshot manual
    match.combat.combatSnapshot.push({
      championKey,
      id,
      team,
      combatSlot: newChampion.combatSlot,
    });
  }

  io.emit("gameStateUpdate", getGameState());

  return newChampion;
}

/** Instancia e registra campeões de uma lista de keys em um time (fase de seleção inicial). */
/** Apenas os ACTIVE_PER_TEAM primeiros entram em campo; os restantes ficam na fila de reserva. */
function assignChampionsToTeam(team, championKeys) {
  championKeys.slice(0, ACTIVE_PER_TEAM).forEach((championKey, index) => {
    if (!championKey) return;
    spawnChampion({
      championKey,
      team,
      combatSlot: index,
      trackSnapshot: false,
      emit: false,
    });
  });
}

/** Inicializa a fila de reserva de um jogador (DESATIVADO). */
function initReserveQueue(_player) {
  // Sistema de reservas desativado para modo 3x3 fixo.
}

/**
 * Limpa ultMeter e todos os efeitos temporários de um campeão ao sair de campo por troca.
 * Modifiers com isPermanent=true (statModifiers) ou permanent=true (damageModifiers) são mantidos.
 */
function clearTemporaryEffectsOnSwitch(_champion) {
  // Sistema de switch desativado para modo 3x3 fixo.
}

// /** Emite backChampionUpdate com a fila completa de reserva do time. */
// function emitBackChampionUpdate(_team) {
//   // Sistema de reservas desativado para modo 3x3 fixo.
// }

/**
 * Spawna o próximo campeão da fila de reserva do time.
 *
 * @param {number} team
 * @param {object} [opts]
 * @param {'death'|'switch'} [opts.reason='death']  Por morte automática ou por troca manual.
 * @param {string|null}      [opts.championToSwitchOutId]  ID do campeão a substituir (apenas reason='switch').
 * @returns {Champion|null}
 */
// function spawnFromReserve(_team, _opts = {}) {
//   // Sistema de reservas desativado para modo 3x3 fixo.
//   return null;
// }

/** Verifica se ambos os jogadores selecionaram seus times e notifica os clientes. */
function checkAllTeamsSelected() {
  if (match.isTeamSelected(0) && match.isTeamSelected(1)) {
    io.emit("allTeamsSelected");
    io.emit("gameStateUpdate", getGameState());
    return true;
  }
  return false;
}

/** Emite os sockets de morte de um campeão a partir do resultado de match.removeChampionFromGame(). */
function emitChampionDeath(deathResult) {
  if (!deathResult) return;

  const champ =
    match.combat.activeChampions.get(deathResult.championId) ||
    match.combat.deadChampions.get(deathResult.championId);

  console.log("[BACKEND][DEATH BEFORE EMIT]", {
    id: champ?.id,
    name: champ?.name,
    HP: champ?.HP,
    alive: champ?.alive,
    deathClaimTriggered: champ?.runtime?.deathClaimTriggered,
  });

  if (deathResult.scored) {
    io.emit("scoreUpdate", match.getScorePayload());
    io.emit(
      "combatLog",
      `${formatPlayerName(
        match.players[deathResult.scoringPlayerSlot]?.username,
        deathResult.scoringTeam,
      )} marcou um ponto!`,
    );
  }

  // Garantimos que o estado do campeão morto (com runtime atualizado) seja enviado
  const state = getGameState(champ ? [champ] : []);

  const deadChampInState = state.champions.find(
    (c) => c.id === deathResult.championId,
  );

  console.log("[BACKEND][GAMESTATE SNAPSHOT]", {
    found: !!deadChampInState,
    deathClaimTriggered: deadChampInState?.runtime?.deathClaimTriggered,
  });

  io.emit("gameStateUpdate", state);
  io.emit("championRemoved", deathResult.championId);
}

// ============================================================
//  VALIDAÇÃO DE AÇÕES (pré-resolução)
// ============================================================

/**
 * Valida se o campeão pode SOLICITAR o uso de uma habilidade.
 * Chamada em "requestSkillUse" — rejeita imediatamente via socket.
 */
function validateActionIntent(user, skill, socket) {
  // console.log("[VALIDATE ACTION CALLED]", user?.name);
  if (!user.alive) {
    socket.emit("skillDenied", "Campeão morto.");
    return false;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    socket.emit("skillDenied", "Já agiu neste turno.");
    return false;
  }

  return true;
}

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

  /*   console.log(
    ` ${champion.name} regenerou ${applied} de ult no início do turno. Ult atual: ${champion.ultMeter}/${champion.ultCap}`,
  ); */

  return applied;
}

//  EMISSÃO DE AÇÕES DE COMBATE (v2)
// ============================================================

/**
 * Extrai efeitos visuais ordenados a partir de um resultado do CombatResolver.
 * Retorna um array de efeitos que o cliente animará sequencialmente.
 */

function buildEmitTargetInfo(realTargetIds) {
  let targetName = null;

  if (realTargetIds.length === 1) {
    const champ =
      match.combat.activeChampions.get(realTargetIds[0]) ??
      match.combat.deadChampions.get(realTargetIds[0]);

    targetName = champ ? formatChampionName(champ) : null;
  } else if (realTargetIds.length > 1) {
    const names = realTargetIds.map((id) => {
      const champ =
        match.combat.activeChampions.get(id) ??
        match.combat.deadChampions.get(id);

      return champ ? formatChampionName(champ) : "Desconhecido";
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

  /*   const reactionEnvelopes = buildReactionEnvelopesFromContext({
    user,
    skill,
    context,
  }); */

  if (mainEnvelope) {
    /* console.log(
      "SERVER SNAPSHOT ULT:",
      [...match.combat.activeChampions.values()].map((c) => ({
        name: c.name,
        ult: c.ultMeter,
      })),
    );
    */
    const {
      damageEvents = [],
      healEvents = [],
      shieldEvents = [],
      buffEvents = [],
      resourceEvents = [],
      globalDialogs = [],
    } = mainEnvelope;

    const hasVisualChanges =
      damageEvents.length ||
      healEvents.length ||
      shieldEvents.length ||
      buffEvents.length ||
      resourceEvents.length ||
      globalDialogs.length;

    const shouldEmit = mainEnvelope.action || hasVisualChanges;

    if (shouldEmit) {
      /* console.log("[DEBUG] [JEFF REVIVAL DIALOG] === ENVELOPE SEND ===", {
        globalDialogs: context.visual.globalDialogs,
      }); */
      emitCombatAction(mainEnvelope);
    }
  }

  /* for (const envelope of reactionEnvelopes) {
    emitCombatAction(envelope);
  } */
}

function buildMainEnvelopeFromContext({ user, skill, context }) {
  const {
    damageEvents = [],
    healEvents = [],
    shieldEvents = [],
    buffEvents = [],
    resourceEvents = [],
    globalDialogs = [],
  } = context.visual || {};

  const userId = user?.id ?? null;
  const userName = user?.name ?? null;

  const mainDamage = damageEvents.filter((d) => (d.damageDepth ?? 0) === 0);
  const mainHeal = healEvents.filter((h) => (h.damageDepth ?? 0) === 0);
  const mainShield = shieldEvents.filter((s) => (s.damageDepth ?? 0) === 0);
  const mainBuff = buffEvents.filter((b) => (b.damageDepth ?? 0) === 0);
  const mainResource = resourceEvents.filter((r) => (r.damageDepth ?? 0) === 0);

  // Coleta todos os alvos afetados (dano, cura, buff, shield)
  const allTargetIds = [...mainDamage, ...mainHeal, ...mainShield, ...mainBuff]
    .map((e) => e.targetId)
    .filter((id) => id && id !== userId);

  // Remove duplicatas
  const uniqueTargetIds = [...new Set(allTargetIds)];

  // Separa inimigos e aliados
  const userTeam = user?.team;
  const enemies = uniqueTargetIds.filter((id) => {
    const champ =
      match.combat.activeChampions.get(id) ??
      match.combat.deadChampions.get(id);
    return champ && userTeam !== undefined && champ.team !== userTeam;
  });
  const allies = uniqueTargetIds.filter((id) => {
    const champ =
      match.combat.activeChampions.get(id) ??
      match.combat.deadChampions.get(id);
    return champ && userTeam !== undefined && champ.team === userTeam;
  });

  // Regra: se houver inimigos, só mostra inimigos; senão, mostra aliados
  const realTargetIds = enemies.length > 0 ? enemies : allies;

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

    globalDialogs,

    state: context._intermediateSnapshot,
  };
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

function emitCombatLogsFromResults(results = []) {
  if (!Array.isArray(results) || results.length === 0) return;

  // Suporta: objeto plano, array de objetos, arrays aninhados, DamageEvent, { log: ... }
  const flatResults = results.flat(Infinity);
  for (const result of flatResults) {
    if (!result || typeof result !== "object") continue;
    const log = result.log;
    if (typeof log === "string" && log.trim()) {
      io.emit("combatLog", log);
    }
  }
}

// ============================================================
//  RESOLUÇÃO DE TURNOS
// ============================================================

function handleEndTurn() {
  io.emit("turnLocked");

  // 1. Resolver todas as ações via TurnResolver (switches têm prioridade 6 — saem primeiro)
  const resolver = new TurnResolver(match, editMode);
  const { actionResults, deathResults } = resolver.resolveTurn();

  // 2. Processamento de switch/substituição desativado (modo 3x3 fixo).

  // 3. Emitir envelopes para cada resultado
  for (const result of actionResults) {
    if (result.executed) {
      emitCombatEnvelopesFromContext({
        user: result.user,
        skill: result.skill,
        context: result.context,
      });
      emitCombatLogsFromResults(result.results);
    } else if (result.reason === "denied" && result.denial) {
      io.emit("combatAction", {
        dialogEvents: [
          {
            message: result.denial.message,
          },
        ],
      });
    } else if (result.logMessage) {
      io.emit("combatLog", result.logMessage);
    }
  }

  // 3. Emitir mortes
  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  if (match.isGameEnded()) {
    const winnerSlot = match.combat.playerScores[0] >= MAX_SCORE ? 0 : 1;
    const winnerTeam = winnerSlot + 1;
    const winnerName = match.players[winnerSlot]?.username;
    io.emit("gameOver", { winnerTeam, winnerName });
  }

  // 4. Hooks onTurnEnd
  const context = {
    currentTurn: match.combat.currentTurn,
    activeChampions: Array.from(match.combat.activeChampions.values()).filter(
      (c) => c.alive,
    ),
  };

  emitCombatEvent("onTurnEnd", { context }, match.combat.activeChampions);

  // 5. Limpeza de turno e avanço
  match.clearActions();
  match.clearTurnReadiness();
  match.clearFinishedAnimationSockets();
  match.nextTurn();

  // 6. Sinaliza clientes que todos os eventos de combate foram emitidos
  waitingForAnimations = true;
  io.emit("combatPhaseComplete");
}

function handleScheduledEffect(effect, context) {
  switch (effect.type) {
    case "spawnChampion": {
      // Se for revival, remova o antigo Jeff antes de spawnar o novo
      if (effect.payload.reviveFrom && effect.payload.reviveFrom.id) {
        match.combat.removeChampion(effect.payload.reviveFrom.id);
      }
      // Garante que o novo Jeff nasce no mesmo combatSlot
      const spawned = spawnChampion({
        ...effect.payload,
        combatSlot: effect.payload.combatSlot ?? null,
      });
      // Suporte para transferência de estado do Jeff antigo
      if (spawned && typeof effect.payload.onSpawn === "function") {
        // Se reviveFrom foi passado, injeta como 3º argumento
        effect.payload.onSpawn(
          spawned,
          context,
          effect.payload.reviveFrom || null,
        );
      }
      break;
    }

    case "damage": {
      const resolver = new TurnResolver(match, editMode);
      const ctx = resolver.createBaseContext({
        sourceId: effect.payload.attackerId,
      });
      const targets = Array.isArray(effect.payload.defenderIds)
        ? effect.payload.defenderIds
        : [effect.payload.defenderId];

      for (const defId of targets) {
        const attacker = match.combat.activeChampions.get(
          effect.payload.attackerId,
        );
        const defender = match.combat.activeChampions.get(defId);
        if (!attacker || !defender || !defender.alive) continue;

        const dmg = new DamageEvent({
          attacker,
          defender,
          skill: effect.payload.skill ?? null,
          context: ctx,
          baseDamage: effect.payload.baseDamage ?? 0,
          mode: effect.payload.mode,
          piercingPortion: effect.payload.piercingPortion,
          allChampions: match.combat.activeChampions,
        });
        dmg.execute();
      }
      break;
    }

    default:
      if (typeof effect.execute === "function") {
        effect.execute();
      }
      break;
  }
}

/** Aplica regeneração global de HP/MP/Energy no início do turno. */
function handleStartTurn() {
  const resolver = new TurnResolver(match, editMode);
  const turnStartContext = resolver.createBaseContext({ sourceId: null });

  console.log("[DEBUG] [JEFF REVIVAL DIALOG] CTX ID:");
  console.dir(turnStartContext, { depth: 2 });

  console.log("[DEBUG] [JEFF REVIVAL DIALOG] CTX.VISUAL INICIAL: ");
  console.dir(turnStartContext.visual, { depth: null });

  // 1. Injetar contexto
  match.combat.activeChampions.forEach((champ) => {
    if (!champ.alive) return;
    champ.runtime = champ.runtime || {};
    champ.runtime.currentContext = turnStartContext;
  });

  // 3. Hooks onTurnStart (DoTs, passivas reativas, etc.)
  emitCombatEvent(
    "onTurnStart",
    { context: turnStartContext },
    match.combat.activeChampions,
  );

  // 4. Executar scheduled effects deste turno (inclusive os agendados durante onTurnStart)
  const currentTurn = match.combat.currentTurn;
  const remaining = [];

  for (const effect of match.combat.scheduledEffects) {
    if (effect.turnToHappen === currentTurn) {
      handleScheduledEffect(effect, turnStartContext);
      if (effect.dialog) {
        console.log("[DEBUG] [JEFF REVIVAL DIALOG] → REGISTRANDO DIALOG");

        console.log(
          "[DEBUG] [JEFF REVIVAL DIALOG] → DIALOG RAW:",
          effect.dialog,
        );

        console.log(
          "[DEBUG] [JEFF REVIVAL DIALOG] → MESSAGE:",
          effect.dialog?.message,
        );

        console.log(
          "[DEBUG] [JEFF REVIVAL DIALOG] → TYPE:",
          typeof effect.dialog?.message,
        );

        turnStartContext.registerDialog(effect.dialog);

        console.log(
          "[DEBUG] [JEFF REVIVAL DIALOG] → globalDialogs (safe):",
          Array.isArray(turnStartContext.visual.globalDialogs)
            ? turnStartContext.visual.globalDialogs.map((d) => d && d.message)
            : turnStartContext.visual.globalDialogs,
        );
      }
    } else {
      remaining.push(effect);
    }
  }
  match.combat.scheduledEffects = remaining;

  const deathResults = resolver.processChampionDeaths(3, turnStartContext);

  for (const death of deathResults) {
    emitChampionDeath(death);
  }

  // 3. Limpar expirados
  match.combat.activeChampions.forEach((champion) => {
    champion.purgeExpiredStatModifiers(match.combat.currentTurn);
    champion.purgeExpiredStatusEffects(match.combat.currentTurn);
  });

  // 5. Regen global
  match.combat.activeChampions.forEach((champion) => {
    const applied = applyGlobalTurnRegen(champion, turnStartContext);

    /* console.log(
      "[ULT REGEN]",
      champion.name,
      "aplicado:",
      applied,
      "depois:",
      champion.ultMeter,
    );
    */
  });

  // 6. Limpar runtime context
  match.combat.activeChampions.forEach((champ) => {
    if (champ.runtime) delete champ.runtime.currentContext;
  });

  console.log("[DEBUG] [JEFF REVIVAL DIALOG] === ANTES DO EMIT ===", {
    globalDialogs: turnStartContext.visual.globalDialogs,
    damageEvents: turnStartContext.visual.damageEvents,
    healEvents: turnStartContext.visual.healEvents,
    buffEvents: turnStartContext.visual.buffEvents,
  });

  console.log("[DEBUG] [JEFF REVIVAL DIALOG] CTX FINAL: ");
  console.dir(turnStartContext, { depth: 2 });

  console.log("[DEBUG] [JEFF REVIVAL DIALOG] CTX.VISUAL FINAL: ");
  console.dir(turnStartContext.visual, { depth: null });

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

    const newChampion = Champion.fromBaseData(baseData, champ.id, champ.team, {
      combatSlot: champ.combatSlot,
    });

    match.combat.registerChampion(newChampion, { trackSnapshot: false });
  }

  match.combat.combatSnapshot = snapshot;
  match.combat.start();

  // console.log("[DEBUG] Combat state reset.");
}

// ============================================================
//  SOCKET HANDLERS
// ============================================================

io.on("connection", (socket) => {
  console.log("Um usuário conectado:", socket.id);
  console.log("Total de usuários conectados:", io.engine.clientsCount);

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
    if (!waitingForAnimations) return;
    if (match.getSlotBySocket(socket.id) === undefined) return;

    match.addFinishedAnimationSocket(socket.id);

    if (match.getFinishedAnimationCount() >= 2) {
      waitingForAnimations = false;
      match.clearFinishedAnimationSockets();
      handleStartTurn();
    }
  });

  // --- Helpers internos à conexão ---

  /** Atribui um slot de jogador e notifica o cliente. */
  function assignPlayerSlot(username) {
    // Se este socket já possui um slot, não criar outro (evita duplicação por autoLogin + clique manual)
    const existingSlot = match.getSlotBySocket(socket.id);
    if (existingSlot !== undefined) {
      const existingPlayer = match.getPlayer(existingSlot);
      if (existingPlayer) {
        return {
          playerSlot: existingSlot,
          finalUsername: existingPlayer.username,
        };
      }
    }

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
    // io.emit("switchesUpdate", {
    //   team1: match.players[0]?.remainingSwitches ?? 0,
    //   team2: match.players[1]?.remainingSwitches ?? 0,
    // });

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

    // Sistema de reserva/switch desativado.
    // initReserveQueue(match.players[0]);
    // initReserveQueue(match.players[1]);

    io.emit("scoreUpdate", match.getScorePayload());
    io.emit("gameStateUpdate", getGameState());

    // emitBackChampionUpdate(match.players[0].team);
    // emitBackChampionUpdate(match.players[1].team);
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
      // console.log("PLAYERS:", match.players);
      // console.log("CONNECTED COUNT:", connectedCount);
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
  //  requestSwitch (DESATIVADO)
  // =============================

  // socket.on("requestSwitch", () => {
  //   return socket.emit("switchDenied", "Sistema de trocas desativado.");
  // });

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

    const deathResult = match.removeChampionFromGame(championId, MAX_SCORE);
    emitChampionDeath(deathResult);

    // Sistema de reserva/switch desativado.

    if (match.isGameEnded()) {
      const winnerSlot = match.combat.playerScores[0] >= MAX_SCORE ? 0 : 1;
      const winnerTeam = winnerSlot + 1;
      const winnerName = match.players[winnerSlot]?.username;
      io.emit("gameOver", { winnerTeam, winnerName });
    }
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
    const playerSlot = match.getSlotBySocket(socket.id);

    if (playerSlot === undefined) return;

    const playerTeam = playerSlot + 1;

    // console.log("[UNDO] Player team:", playerTeam);

    for (let i = match.combat.pendingActions.length - 1; i >= 0; i--) {
      // Se não tem nada no array, sair do loop
      if (!match.combat.pendingActions.length) {
        console.warn("Pedido de undo sem ações pendentes.");
        break; // SAI DO LOOP, mas continua a execução da função abaixo do loop
      }
      const action = match.combat.pendingActions[i];
      const champ = match.combat.activeChampions.get(action.userId);

      if (!champ) continue;

      if (champ.team !== playerTeam) continue;

      // reverter estado
      champ.hasActedThisTurn = false;

      if (action.ultCost > 0) {
        champ.addUlt({ amount: action.ultCost });
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
    /* console.log("[USE SKILL] Recebido pedido de uso de skill:", {
      userId,
      skillKey,
      targetIds,
    });
    */
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

    const action = new Action({ userId, skillKey, targetIds });
    action.priority = skill.priority || 0;
    action.speed = user.Speed;
    action.turn = match.getCurrentTurn();
    action.ultCost = cost;

    match.enqueueAction(action);

    // console.log("[PENDING ACTION ADDED]", match.combat.pendingActions);

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
