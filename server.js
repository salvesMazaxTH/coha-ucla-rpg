import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import { championDB } from "./data/championDB.js";
import { Champion } from "./core/Champion.js";
import {
  isSkillOnCooldown,
  startCooldown,
  checkAndValidateCooldowns,
} from "./core/cooldown.js";
import { generateId } from "./core/id.js";
import { formatChampionName, formatPlayerName } from "./core/formatters.js";

const editMode = {
  enabled: true,
  autoSelection: false, // Seleção automática de campeões para ambos os jogadores
  ignoreCooldowns: true, // Ignora cooldowns para facilitar os testes
  actMultipleTimesPerTurn: true, // Permite que os campeões ajam múltiplas vezes por turno
};

const TEAM_SIZE = 2; // Define o tamanho da equipe para 2v2, aumentar depois para 3v3 ou mais se necessário

// Helper para __dirname em módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

let players = [null, null]; // Array para armazenar dados do jogador para o slot 0 (Time 1) e slot 1 (Time 2)
let connectedSockets = new Map(); // Mapeia socket.id para o índice do slot do jogador
let playerNames = new Map(); // Mapeia o slot do jogador para o nome de usuário
let playerTeamsSelected = [false, false]; // Rastreia se cada jogador selecionou sua equipe
let championSelectionTimers = [null, null]; // Timers para a seleção de campeões de cada jogador
const CHAMPION_SELECTION_TIME = 120; // 120 segundos para seleção de campeões
let playerScores = [0, 0]; // Pontuações para o jogador 1 (índice 0) e jogador 2 (índice 1)
const MAX_SCORE = 2; // Melhor de 3, então o primeiro a 2 vence
let gameEnded = false;

const activeChampions = new Map();
let currentTurn = 1;
let playersReadyToEndTurn = new Set(); // Rastreia quais slots de jogador confirmaram o fim do turno
let pendingActions = []; // Array para armazenar ações para o turno atual

let disconnectionTimers = new Map(); // Mapeia o slot do jogador para um timer de desconexão
const DISCONNECT_TIMEOUT = 30 * 1000; // 30 segundos

// ======== Turn History Tracking System ========
// Armazena histórico de eventos por turno para suportar habilidades baseadas em histórico
let turnHistory = new Map(); // { turnNumber: { events: [...], championsDeadThisTurn: [], skillsUsedThisTurn: {} } }

/**
 * Log de um evento que aconteceu durante o turno atual
 * @param {string} eventType - Tipo do evento (e.g., 'skillUsed', 'championDied', 'statChanged')
 * @param {object} eventData - Dados do evento
 */
function logTurnEvent(eventType, eventData) {
  if (!turnHistory.has(currentTurn)) {
    turnHistory.set(currentTurn, {
      events: [],
      championsDeadThisTurn: [],
      skillsUsedThisTurn: {},
      damageDealtThisTurn: {},
    });
  }

  const turnData = turnHistory.get(currentTurn);
  turnData.events.push({
    type: eventType,
    ...eventData,
    timestamp: Date.now(),
  });
}

/**
 * Verifica se um campeão morreu em um turno específico
 * @param {string} championId - ID do campeão
 * @param {number} turnNumber - Número do turno (padrão: turno anterior)
 * @returns {boolean}
 */
function didChampionDieInTurn(championId, turnNumber = currentTurn - 1) {
  if (!turnHistory.has(turnNumber)) return false;
  const turnData = turnHistory.get(turnNumber);
  return turnData.championsDeadThisTurn.includes(championId);
}

/**
 * Verifica se um campeão usou uma habilidade específica em um turno
 * @param {string} championId - ID do campeão
 * @param {string} skillKey - Chave da habilidade
 * @param {number} turnNumber - Número do turno (padrão: turno anterior)
 * @returns {boolean}
 */
function didChampionUseSkillInTurn(
  championId,
  skillKey,
  turnNumber = currentTurn - 1,
) {
  if (!turnHistory.has(turnNumber)) return false;
  const turnData = turnHistory.get(turnNumber);
  return turnData.skillsUsedThisTurn[championId]?.includes(skillKey) ?? false;
}

/**
 * Obtém todos os eventos de um turno específico
 * @param {number} turnNumber - Número do turno
 * @returns {array}
 */
function getTurnEvents(turnNumber) {
  if (!turnHistory.has(turnNumber)) return [];
  return turnHistory.get(turnNumber).events;
}

/**
 * Obtém dados completos de um turno
 * @param {number} turnNumber - Número do turno
 * @returns {object}
 */
function getTurnData(turnNumber) {
  return turnHistory.get(turnNumber) || null;
}

// ======== End Turn History Tracking System ========

function getGameState() {
  const championsData = Array.from(activeChampions.values()).map((c) =>
    c.serialize(),
  );

  return {
    champions: championsData,
    currentTurn: currentTurn,
  };
}

function getRandomChampionKey(excludeKeys = []) {
  const availableKeys = Object.keys(championDB).filter(
    (key) => !excludeKeys.includes(key),
  );
  if (availableKeys.length === 0) {
    return null; // Nenhum campeão disponível
  }
  const randomIndex = Math.floor(Math.random() * availableKeys.length);
  return availableKeys[randomIndex];
}

function assignChampionsToTeam(team, championKeys) {
  championKeys.forEach((championKey) => {
    if (championKey) {
      const baseData = championDB[championKey];
      if (baseData) {
        const id = generateId(championKey);
        
        const newChampion = Champion.fromBaseData(baseData, id, team);

        activeChampions.set(id, newChampion);
      } else {
        /*  console.error(`[Server] Chave de campeão inválida fornecida: ${championKey}`); */
      }
    }
  });
}

function checkAllTeamsSelected() {
  if (playerTeamsSelected[0] && playerTeamsSelected[1]) {
    // console.log("[Server] Todas as equipes selecionadas. Iniciando o jogo.");
    io.emit("allTeamsSelected"); // Notifica os clientes para ocultar a tela de seleção e mostrar o conteúdo principal
    io.emit("gameStateUpdate", getGameState()); // Envia o estado inicial do jogo com os campeões selecionados
    return true;
  }
  return false;
}

// Função para remover campeão (reutilizável)
function removeChampionFromGame(championId, playerTeam) {
  console.log(`[Server] removeChampionFromGame chamado para ${championId}`); // ← ESSE
  const championToRemove = activeChampions.get(championId);

  if (!championToRemove) {
    console.error(`[Server] Campeão ${championId} não encontrado.`);
    return;
  }

  // Log do evento de morte do campeão no histórico de turnos
  logTurnEvent("championDied", {
    championId: championId,
    championName: championToRemove.name,
    team: championToRemove.team,
  });

  // Adicionando à lista de campeões mortos neste turno
  if (!turnHistory.has(currentTurn)) {
    turnHistory.set(currentTurn, {
      events: [],
      championsDeadThisTurn: [],
      skillsUsedThisTurn: {},
      damageDealtThisTurn: {},
    });
  }
  turnHistory.get(currentTurn).championsDeadThisTurn.push(championId);

  // Determina qual jogador pontuou
  const scoringTeam = championToRemove.team === 1 ? 2 : 1; // Se o campeão do time 1 morre, o time 2 pontua
  const scoringPlayerSlot = scoringTeam - 1;

  if (!gameEnded) {
    playerScores[scoringPlayerSlot]++;
    io.emit("scoreUpdate", {
      player1: playerScores[0],
      player2: playerScores[1],
    });
    const scoringPlayerName = formatPlayerName(
      playerNames.get(scoringPlayerSlot),
      scoringTeam,
    );
    io.emit("combatLog", `${scoringPlayerName} pontuou!`);

    if (playerScores[scoringPlayerSlot] >= MAX_SCORE) {
      gameEnded = true;
      io.emit("gameOver", {
        winnerTeam: scoringTeam,
        winnerName: playerNames.get(scoringPlayerSlot),
      });
      const winnerName = formatPlayerName(
        playerNames.get(scoringPlayerSlot),
        scoringTeam,
      );
      io.emit("combatLog", `Fim de jogo! ${winnerName} venceu a partida!`);
      // Opcionalmente, redefine o estado do jogo ou prepara para uma nova partida aqui
      // Por enquanto, apenas impede mais pontuações/ações
    }
  }

  activeChampions.delete(championId);
  console.log(`[Server] Emitindo championRemoved para ${championId}`);
  io.emit("championRemoved", championId);

  // Introduz um atraso para permitir que a animação de morte seja reproduzida no cliente
  const CLIENT_DEATH_ANIMATION_DURATION = 2000; // Deve corresponder à duração da animação no lado do cliente
  const SERVER_DELAY_AFTER_ANIMATION = 500; // Atraso adicional para o servidor enviar gameStateUpdate

  setTimeout(() => {
    // Verifica se precisa trazer o campeão de trás
    const activeChampionsInTeam = Array.from(activeChampions.values()).filter(
      (c) => c.team === playerTeam,
    ).length;

    const playerSlot = playerTeam - 1; // time 1 = slot 0, time 2 = slot 1
    const player = players[playerSlot];

    if (activeChampionsInTeam < 2 && player && player.backChampion) {
      // console.log(
      //   `[Server] Trazendo o campeão de trás ${player.backChampion} para o Time ${playerTeam}.`,
      // );
      assignChampionsToTeam(playerTeam, [player.backChampion]);
      player.backChampion = null;
      io.emit("backChampionUpdate", { team: playerTeam, championKey: null });
    }

    io.emit("gameStateUpdate", getGameState());
  }, SERVER_DELAY_AFTER_ANIMATION + CLIENT_DEATH_ANIMATION_DURATION);
}

// Função auxiliar para validar se um campeão pode agir (incluindo keywords bloqueantes)
function validateActionIntent(user, socket) {
  // morto
  if (!user.alive) {
    socket.emit("skillDenied", "Campeão morto.");
    return false;
  }

  // já agiu
  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    socket.emit("skillDenied", "Já agiu neste turno.");
    return false;
  }

  // keyword: paralisado (bloqueante completo)
  if (user.hasKeyword?.("paralisado")) {
    const k = user.getKeyword("paralisado");
    socket.emit("skillDenied", `${user.name} está Paralisado e não pode agir!`);
    return false;
  }

  // keyword: atordoado (bloqueante completo)
  if (user.hasKeyword?.("atordoado")) {
    socket.emit("skillDenied", `${user.name} está Atordoado e não pode agir!`);
    return false;
  }

  // keyword: inerte
  if (user.hasKeyword?.("inerte")) {
    const k = user.getKeyword("inerte");

    // Pode interromper
    if (k?.canBeInterruptedByAction) {
      user.removeKeyword("inerte");
      const userName = formatChampionName(user);
      io.emit(
        "combatLog",
        `O efeito "Inerte" de ${userName} foi interrompido!`,
      );
      return true;
    }

    socket.emit("skillDenied", `${user.name} está Inerte e não pode agir!`);
    return false;
  }

  return true;
}

function canExecuteAction(user) {
  const userName = formatChampionName(user);

  // inexistente ou morto
  if (!user || !user.alive) {
    io.emit("combatLog", `Ação ignorada: ${userName} não está ativo.`);
    return false;
  }

  // keywords bloqueantes diretas
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
      console.log(`[Server] Ação cancelada: ${user.name} está ${label}.`);
      return false;
    }
  }

  // tratamento especial: Inerte
  if (user.hasKeyword?.("inerte")) {
    const k = user.getKeyword("inerte");

    if (!k?.canBeInterruptedByAction) {
      io.emit(
        "combatLog",
        `${userName} tentou agir mas estava Inerte! Ação cancelada.`,
      );
      console.log(`[Server] Ação cancelada: ${user.name} está Inerte.`);
      return false;
    }

    // interrompido pela ação
    user.removeKeyword("inerte");
    io.emit("combatLog", `O efeito "Inerte" de ${userName} foi interrompido!`);
  }

  return true;
}

// ======== TURN RESOLUTION HELPER FUNCTIONS ========

/**
 * Executa uma ação (habilidade) individual
 * @param {object} action - Ação a executar
 * @returns {boolean} - true se a ação foi executada com sucesso
 */

function resolveSkillTargets(user, skill, action) {
  const currentTargets = {};
  let redirected = false;

  // ----- PROVOKE -----
  if (user.provokeEffects.length > 0 && skill.targetSpec.includes("enemy")) {
    const provokerId = user.provokeEffects[0].provokerId;
    const provoker = activeChampions.get(provokerId);

    if (provoker && provoker.alive) {
      for (const role in action.targetIds) {
        const original = activeChampions.get(action.targetIds[role]);

        if (original && original.team !== user.team) {
          currentTargets[role] = provoker;
          redirected = true;
        } else {
          currentTargets[role] = original;
        }
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

  // ----- NORMAL RESOLUTION -----
  if (!redirected) {
    for (const role in action.targetIds) {
      const target = activeChampions.get(action.targetIds[role]);

      if (!target || !target.alive) {
        io.emit(
          "combatLog",
          `Alvo inválido ou inativo para a ação de ${formatChampionName(user)}. Ação cancelada.`,
        );
        return null;
      }

      currentTargets[role] = target;
    }
  }

  return currentTargets;
}

function performSkillExecution(user, skill, targets) {
  startCooldown(user, skill, currentTurn);

  const aliveChampionsArray = [...activeChampions.values()].filter(
    (c) => c.alive,
  );

  const context = {
    currentTurn,
    allChampions: activeChampions,
    aliveChampions: aliveChampionsArray,
  };

  const result = skill.execute({
    user,
    targets,
    context,
  });

  // 🔥 remover Epifania quando agir
  if (user.hasKeyword?.("epifania_ativa")) {
    user.removeKeyword("epifania_ativa");

    user.removeDamageReductionBySource?.("epifania");
    user.removeKeyword("imunidade absoluta");

    io.emit(
      "combatLog",
      `${formatChampionName(user)} deixou o Limiar da Existência.`,
    );
  }

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

  if (!turnHistory.has(currentTurn)) {
    turnHistory.set(currentTurn, {
      events: [],
      championsDeadThisTurn: [],
      skillsUsedThisTurn: {},
      damageDealtThisTurn: {},
    });
  }

  const turnData = turnHistory.get(currentTurn);

  if (!turnData.skillsUsedThisTurn[user.id]) {
    turnData.skillsUsedThisTurn[user.id] = [];
  }

  turnData.skillsUsedThisTurn[user.id].push(skill.key);

  if (result) {
    if (Array.isArray(result)) {
      result.forEach((r) => io.emit("combatLog", r.log));
    } else {
      io.emit("combatLog", result.log);
    }
  }
}

function executeSkillAction(action) {
  const user = activeChampions.get(action.championId);

  if (!user || !user.alive) {
    const userName = user ? formatChampionName(user) : "campeão desconhecido";
    io.emit("combatLog", `Ação de ${userName} ignorada (não ativo).`);
    return false;
  }

  if (!canExecuteAction(user)) return false;

  const skill = user.skills.find((s) => s.key === action.skillKey);
  if (!skill) {
    io.emit(
      "combatLog",
      `Erro: Habilidade ${action.skillKey} não encontrada para ${formatChampionName(user)}.`,
    );
    return false;
  }

  const targets = resolveSkillTargets(user, skill, action);
  if (!targets) return false;

  performSkillExecution(user, skill, targets);

  return true;
}

/**
 * Resolve todas as ações pendentes na ordem correta
 */
function resolveSkillActions() {
  // Ordenar por prioridade e velocidade
  pendingActions.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority; // Maior prioridade primeiro
    }
    return b.speed - a.speed; // Maior velocidade primeiro
  });

  console.log(
    `[Server] Resolvendo ${pendingActions.length} ações pendentes...`,
  );

  // Executar cada ação
  for (const action of pendingActions) {
    executeSkillAction(action);
  }

  pendingActions = []; // Limpar ações pendentes
  console.log("[Server] Todas as ações resolvidas.");
}

// Processa mortes de campeões
function processChampionsDeaths() {
  for (const champ of activeChampions.values()) {
    if (!champ.alive) {
      removeChampionFromGame(champ.id, champ.team);
    }
  }
}

// Finaliza o turno: resolve ações, incrementa turno, limpa efeitos expirados
function handleEndTurn() {
  console.log("[Server] Iniciando finalização do turno...");

  // Resolver todas as ações pendentes
  resolveSkillActions();

  // Processar mortes de campeões antes mais nada, para que tudo funcione corretamente
  processChampionsDeaths();

  // Incrementar turno
  currentTurn++;
  playersReadyToEndTurn.clear();

  // 🔥 Disparar passivas de início de turno
  activeChampions.forEach((champion) => {
    const hook = champion.passive?.onTurnStart;
    if (!hook) return;

    const result = hook({
      target: champion,
      context: { currentTurn },
    });

    if (result?.log) {
      io.emit("combatLog", result.log);
    }
  });

  // Limpar modificadores de stats expirados
  const revertedStats = [];
  activeChampions.forEach((champion) => {
    const expired = champion.purgeExpiredStatModifiers(currentTurn);
    if (expired.length > 0) {
      revertedStats.push(...expired);
    }
  });

  // Limpar keywords expiradas
  activeChampions.forEach((champion) => {
    const expiredKeywords = champion.purgeExpiredKeywords(currentTurn);
    if (expiredKeywords.length > 0) {
      expiredKeywords.forEach((keyword) => {
        const championName = formatChampionName(champion);
        io.emit(
          "combatLog",
          `Efeito "${keyword}" expirou para ${championName}.`,
        );
      });
    }
  });

  // Emitir atualizações
  io.emit("turnUpdate", currentTurn);
  if (revertedStats.length > 0) {
    io.emit("statsReverted", revertedStats);
  }
  io.emit("gameStateUpdate", getGameState());

  console.log(`[Server] Turno finalizado. Novo turno: ${currentTurn}`);
}

// ======== END TURN RESOLUTION HELPER FUNCTIONS ========

io.on("connection", (socket) => {
  console.log("Um usuário conectado:", socket.id);

  let playerSlot = -1; // Será atribuído no login

  // =============================
  // HELPER FUNCTIONS
  // =============================

  function assignPlayerSlot(username) {
    let playerSlot = -1;

    if (players[0] === null) {
      playerSlot = 0;
    } else if (players[1] === null) {
      playerSlot = 1;
    }

    if (playerSlot === -1) {
      socket.emit(
        "serverFull",
        "O servidor está cheio. Tente novamente mais tarde.",
      );
      socket.disconnect();
      return null;
    }

    const playerId = `player${playerSlot + 1}`;
    const team = playerSlot + 1;
    const finalUsername = editMode.enabled
      ? `Player${playerSlot + 1}`
      : username;

    players[playerSlot] = {
      id: playerId,
      team,
      socketId: socket.id,
      username: finalUsername,
      selectedTeam: [],
    };

    connectedSockets.set(socket.id, playerSlot);
    playerNames.set(playerSlot, finalUsername);

    socket.emit("playerAssigned", {
      playerId,
      team,
      username: finalUsername,
    });

    io.emit("playerCountUpdate", players.filter((p) => p !== null).length);
    io.emit("playerNamesUpdate", Array.from(playerNames.entries()));
    socket.emit("gameStateUpdate", getGameState());

    return { playerSlot, finalUsername };
  }

  function handleChampionSelection() {
    for (let i = 0; i < players.length; i++) {
      if (players[i] && !playerTeamsSelected[i]) {
        io.to(players[i].socketId).emit("startChampionSelection", {
          timeLeft: CHAMPION_SELECTION_TIME,
        });

        championSelectionTimers[i] = setTimeout(() => {
          if (!playerTeamsSelected[i]) {
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
          }
        }, CHAMPION_SELECTION_TIME * 1000);
      }
    }
  }

  function handleEditModeSelection() {
    if (editMode.autoSelection) {
      for (let i = 0; i < players.length; i++) {
        if (players[i] && !playerTeamsSelected[i]) {
          let currentSelection = [];

          while (currentSelection.length < TEAM_SIZE) {
            const champ =
              getRandomChampionKey(currentSelection) ||
              Object.keys(championDB)[0];

            currentSelection.push(champ);
          }

          players[i].selectedTeam = currentSelection;
          playerTeamsSelected[i] = true;
        }
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
    } else {
      handleChampionSelection();
    }
  }

  socket.on("requestPlayerSlot", (username) => {
    // =============================
    // SLOT ASSIGNMENT
    // =============================
    const assignResult = assignPlayerSlot(username);
    if (!assignResult) return;

    const { playerSlot, finalUsername } = assignResult;

    // =============================
    // WAIT FOR SECOND PLAYER
    // =============================
    if (!(players[0] && players[1])) {
      socket.emit(
        "waitingForOpponent",
        `Olá, ${finalUsername}, aguardando outro jogador...`,
      );
      return;
    }

    io.emit("allPlayersConnected");

    // =============================
    // CHAMPION SELECTION
    // =============================
    if (editMode.enabled) {
      handleEditModeSelection();
    } else {
      handleChampionSelection();
    }

    // =============================
    // RECONNECT HANDLING
    // =============================
    if (disconnectionTimers.has(playerSlot)) {
      clearTimeout(disconnectionTimers.get(playerSlot));
      disconnectionTimers.delete(playerSlot);

      const other = playerSlot === 0 ? 1 : 0;

      if (players[other]) {
        io.to(players[other].socketId).emit("opponentReconnected");
      }
    }
  });

  socket.on("disconnect", () => {
    // console.log("Usuário desconectado:", socket.id);

    const disconnectedSlot = connectedSockets.get(socket.id);
    if (disconnectedSlot !== undefined) {
      const disconnectedPlayerName = playerNames.get(disconnectedSlot);
      // Verifica se ambos os jogadores estavam conectados *antes* desta desconexão, para determinar se um jogo estava ativo
      const wasGameActiveBeforeDisconnect =
        players[0] !== null && players[1] !== null;

      // console.log(
      //   `Jogador ${disconnectedPlayerName} (Time ${players[disconnectedSlot].team}) desconectado do slot ${disconnectedSlot}.`,
      // );

      // Limpa qualquer timer de desconexão pendente para este slot, se existir
      if (disconnectionTimers.has(disconnectedSlot)) {
        clearTimeout(disconnectionTimers.get(disconnectedSlot));
        disconnectionTimers.delete(disconnectedSlot);
        // console.log(
        //   `Timer de desconexão para o slot ${disconnectedSlot} limpo após a desconexão real.`,
        // );
      }
      // Limpa o timer de seleção de campeão, se existir
      if (championSelectionTimers[disconnectedSlot]) {
        clearTimeout(championSelectionTimers[disconnectedSlot]);
        championSelectionTimers[disconnectedSlot] = null;
      }

      players[disconnectedSlot] = null; // Libera o slot
      connectedSockets.delete(socket.id);
      playerNames.delete(disconnectedSlot); // Remove o nome do jogador
      playerTeamsSelected[disconnectedSlot] = false; // Redefine o status de seleção da equipe

      // Limpa o estado da confirmação de fim de turno
      playersReadyToEndTurn.delete(disconnectedSlot);
      pendingActions = []; // Cancela todas as ações pendentes

      const currentConnectedPlayers = players.filter((p) => p !== null).length;
      io.emit("playerCountUpdate", currentConnectedPlayers);
      io.emit("playerNamesUpdate", Array.from(playerNames.entries())); // Atualiza os nomes dos jogadores

      // Se não houver jogadores restantes, redefine o estado do jogo imediatamente
      if (currentConnectedPlayers === 0) {
        // console.log("Todos os jogadores desconectados. Redefinindo o estado do jogo.");
        activeChampions.clear(); // Limpa todos os campeões
        currentTurn = 1; // Redefine o turno
        turnHistory.clear(); // Limpa o histórico de turnos
        playerScores = [0, 0]; // Redefine as pontuações
        gameEnded = false; // Redefine a flag de jogo terminado
        io.emit("gameStateUpdate", getGameState()); // Envia o estado vazio do jogo
        // Também limpa quaisquer timers de desconexão restantes, embora não deva haver nenhum se todos os jogadores se foram
        disconnectionTimers.forEach((timer) => clearTimeout(timer));
        disconnectionTimers.clear();
        playerTeamsSelected = [false, false]; // Redefine todas as flags de seleção de equipe
      }
      // Se apenas um jogador permanecer e um jogo estava ativo antes desta desconexão, inicia um timer para o oponente
      else if (wasGameActiveBeforeDisconnect && currentConnectedPlayers === 1) {
        const remainingPlayerSlot = players[0] ? 0 : 1;
        const remainingPlayerSocketId = players[remainingPlayerSlot].socketId;

        // console.log(
        //   `Iniciando timer de ${DISCONNECT_TIMEOUT / 1000} segundos para o slot ${disconnectedSlot}.`,
        // );
        io.to(remainingPlayerSocketId).emit("opponentDisconnected", {
          timeout: DISCONNECT_TIMEOUT,
        });

        const timer = setTimeout(() => {
          // console.log(
          //   `Timer de desconexão para o slot ${disconnectedSlot} expirou. Forçando o jogador restante a sair.`,
          // );
          // Força o jogador restante de volta à tela de login
          io.to(remainingPlayerSocketId).emit(
            "forceLogout",
            "Seu oponente se desconectou e não reconectou a tempo.",
          );

          // Redefine o estado do jogo
          players[remainingPlayerSlot] = null;
          connectedSockets.delete(remainingPlayerSocketId);
          playerNames.delete(remainingPlayerSlot);
          activeChampions.clear(); // Limpa todos os campeões
          currentTurn = 1; // Redefine o turno
          turnHistory.clear(); // Limpa o histórico de turnos
          playerScores = [0, 0]; // Redefine as pontuações
          gameEnded = false; // Redefine a flag de jogo terminado
          io.emit(
            "playerCountUpdate",
            players.filter((p) => p !== null).length,
          ); // Deve ser 0 agora
          io.emit("playerNamesUpdate", Array.from(playerNames.entries())); // Deve estar vazio agora
          io.emit("gameStateUpdate", getGameState()); // Envia o estado vazio do jogo
          disconnectionTimers.delete(disconnectedSlot); // Remove este timer do mapa
          playerTeamsSelected = [false, false]; // Redefine todas as flags de seleção de equipe
        }, DISCONNECT_TIMEOUT);

        disconnectionTimers.set(disconnectedSlot, timer);
      }
    }
  });

  // Lida com a seleção de equipe
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

      let finalTeam = [...selectedChampionKeys];
      const allChampionKeys = Object.keys(championDB);

      // Valida e preenche campeões ausentes
      for (let i = 0; i < TEAM_SIZE; i++) {
        if (!finalTeam[i] || !allChampionKeys.includes(finalTeam[i])) {
          // Encontra um campeão aleatório que ainda não esteja na equipe
          let randomChamp;
          do {
            randomChamp = getRandomChampionKey();
          } while (randomChamp && finalTeam.includes(randomChamp));

          if (randomChamp) {
            finalTeam[i] = randomChamp;
          } else {
            // Fallback se nenhum campeão aleatório único puder ser encontrado (não deve acontecer com campeões suficientes)
            /*             console.warn(
              "[Server] Não foi possível preencher automaticamente um campeão único para o slot",
              i,
            ); */
            finalTeam[i] = Object.keys(championDB)[0]; // Atribui o primeiro disponível como último recurso
          }
        }
      }

      player.selectedTeam = finalTeam;
      playerTeamsSelected[playerSlot] = true;
      // console.log(
      //   `[Server] Jogador ${player.username} (Time ${player.team}) selecionou a equipe:`,
      //   player.selectedTeam,
      // );

      // Limpa o timer de seleção para este jogador
      if (championSelectionTimers[playerSlot]) {
        clearTimeout(championSelectionTimers[playerSlot]);
        championSelectionTimers[playerSlot] = null;
      }

      // Se ambos os jogadores selecionaram suas equipes, atribui-os a activeChampions e inicia o jogo
      if (checkAllTeamsSelected()) {
        activeChampions.clear(); // Limpa quaisquer campeões anteriores
        currentTurn = 1; // Redefine o turno para um novo jogo
        turnHistory.clear(); // Limpa o histórico de turnos para um novo jogo
        playerScores = [0, 0]; // Redefine as pontuações para um novo jogo
        gameEnded = false; // Redefine a flag de jogo terminado
        io.emit("scoreUpdate", {
          player1: playerScores[0],
          player2: playerScores[1],
        }); // Emite as pontuações iniciais

        // Implanta os dois primeiros campeões para cada equipe na arena
        assignChampionsToTeam(
          players[0].team,
          players[0].selectedTeam.slice(0, 2),
        );
        assignChampionsToTeam(
          players[1].team,
          players[1].selectedTeam.slice(0, 2),
        );

        // Armazena o terceiro campeão como o campeão "de trás" para cada jogador
        players[0].backChampion = players[0].selectedTeam[2];
        players[1].backChampion = players[1].selectedTeam[2];

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

  // Lida com a remoção de campeões (e potencialmente trazendo o campeão de trás)
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

  // Lida com a mudança de HP
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
    console.log(
      `[Server] HP do campeão ${champion.name} alterado para ${champion.HP}`,
    ); // ← ESSE

    // Log de mudança de HP no histórico de turnos
    logTurnEvent("hpChanged", {
      championId: championId,
      championName: champion.name,
      oldHP: oldHP,
      newHP: champion.HP,
      amount: amount,
    });

    if (champion.HP <= 0) {
      console.log(
        `[Server] HP do campeão ${champion.name} (ID: ${championId}) caiu para 0. Chamando removeChampionFromGame.`,
      );
      removeChampionFromGame(championId, champion.team);
    } else if (amount > 0 && champion.HP > champion.maxHP) {
      champion.maxHP += amount; // Aumenta o maxHP se curar além do máximo atual
    }
    io.emit("gameStateUpdate", getGameState());
  });

  // Lida com a mudança de estatísticas
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

    const statSteps = {
      Attack: 5,
      Defense: 5,
      Speed: 5,
      Critical: 1,
    };

    const step = statSteps[stat] || 5;
    const delta = action === "up" ? step : -step;
    const oldValue = champion[stat];

    if (stat in champion) {
      champion[stat] += delta;
      if (champion[stat] < 0) champion[stat] = 0;

      // Log de mudança de stat no histórico de turnos
      logTurnEvent("statChanged", {
        championId: championId,
        championName: champion.name,
        stat: stat,
        oldValue: oldValue,
        newValue: champion[stat],
        delta: delta,
      });
    }
    io.emit("gameStateUpdate", getGameState());
  });

  // Lida com o uso de habilidades
  socket.on("requestSkillUse", ({ userId, skillKey }) => {
    const playerSlot = connectedSockets.get(socket.id);
    const player = players[playerSlot];
    const user = activeChampions.get(userId);

    if (!player || !user || user.team !== player.team)
      return socket.emit("skillDenied", "Sem permissão.");

    const skill = user.skills.find((s) => s.key === skillKey);
    if (!skill) return socket.emit("skillDenied", "Skill inválida.");

    if (!validateActionIntent(user, socket)) return;

    let cdError;

    if (!editMode.ignoreCooldowns) {
      cdError = checkAndValidateCooldowns({
        user,
        skill,
        currentTurn,
        editMode,
      });
    }

    if (cdError) return socket.emit("skillDenied", cdError.message);

    socket.emit("skillApproved", { userId, skillKey });
  });

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

    // ja ê verificado cooldown ao solicitar uso da skill

    const targets = {};
    for (const role in targetIds) {
      targets[role] = activeChampions.get(targetIds[role]);
      if (!targets[role]) {
        socket.emit("actionFailed", `Alvo inválido para a função ${role}.`);
        return;
      }
    }

    // Armazena a ação em vez de executar imediatamente
    pendingActions.push({
      championId: userId,
      skillKey: skillKey,
      targetIds: targetIds,
      priority: skill.priority || 0, // Prioridade padrão para 0
      speed: user.Speed, // Armazena a velocidade do campeão no momento da ação
      turn: currentTurn,
    });

    // Emite "Ação pendente" apenas para o jogador que iniciou a ação
    const userName = formatChampionName(user);
    io.to(socket.id).emit(
      "combatLog",
      `${userName} usou ${skill.name}. Ação pendente.`,
    );
    io.emit("gameStateUpdate", getGameState()); // Atualiza o cliente com o estado atual (ex: cooldowns)
  });

  // Lida com o fim do turno
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

    // Marcar jogador como pronto para encerrar turno
    playersReadyToEndTurn.add(playerSlot);
    io.emit("playerConfirmedEndTurn", playerSlot);

    // Se ambos os jogadores confirmaram, processar o fim do turno
    if (playersReadyToEndTurn.size === 2) {
      // Validar se ambos ainda estão conectados
      if (players[0] === null || players[1] === null) {
        playersReadyToEndTurn.clear();
        socket.emit(
          "actionFailed",
          "Seu oponente foi desconectado. O turno foi cancelado.",
        );
        return;
      }

      // Finalizar o turno
      handleEndTurn();
    } else {
      // Um jogador confirmou, aguardando o outro
      socket.emit(
        "waitingForOpponentEndTurn",
        "Aguardando o outro jogador confirmar o fim do turno.",
      );
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
