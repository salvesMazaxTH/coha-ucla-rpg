import { championDB } from "/data/championDB.js";
import { Champion } from "/core/Champion.js";
import { StatusIndicator } from "/core/statusIndicator.js";

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
}); // Inicializa o cliente Socket.IO

let playerId = null;
let playerTeam = null;
let username = null;
const playerNames = new Map(); // Mapeia o slot do jogador para o nome de usuário

const loginScreen = document.getElementById("login-screen");
const mainContent = document.getElementById("main-content");
const usernameInput = document.getElementById("username-input");
const joinArenaBtn = document.getElementById("join-arena-btn");
const loginMessage = document.getElementById("login-message");
const disconnectionMessage = document.getElementById("disconnection-message");
let disconnectionCountdownInterval = null;

let hasConfirmedEndTurn = false;

let gameEnded = false; // Nova flag para rastrear se o jogo terminou

const editMode = false; // Definido como true para auto-entrar para testes

// Elementos da tela de seleção de campeões
const championSelectionScreen = document.getElementById(
  "champion-selection-screen",
);
const availableChampionsGrid = document.getElementById(
  "availableChampionsGrid",
);
const selectedChampionsSlots = document.getElementById(
  "selectedChampionsSlots",
);
const confirmTeamBtn = document.getElementById("confirmTeamBtn");
const teamSelectionMessage = document.getElementById("team-selection-message");

const TEAM_SIZE = 2; // Define o tamanho da equipe para 2v2, aumentar depois para 3v3 ou mais se necessário
let selectedChampions = Array(TEAM_SIZE).fill(null); // Array para armazenar as chaves dos campeões selecionados em ordem
let championSelectionTimer = null;
const CHAMPION_SELECTION_TIME = 120; // 120 segundos
let championSelectionTimeLeft = CHAMPION_SELECTION_TIME;
let playerTeamConfirmed = false; // Flag para evitar reconfirmar a equipe
let allAvailableChampionKeys = []; // Para armazenar todas as chaves de campeões do DB

// Adicionar ao início do arquivo, para garantir que StatusIndicator está disponível globalmente se necessário
window.StatusIndicator = StatusIndicator;

socket.on("connect", () => {
  if (editMode) {
    // Entra automaticamente com um nome de usuário fixo no editMode
    username = "EditUser";
    socket.emit("requestPlayerSlot", username);
  }
  // console.log("Conectado ao servidor com ID:", socket.id);
});

socket.on("playerAssigned", (data) => {
  playerId = data.playerId;
  playerTeam = data.team;
  username = data.username;
  /*
  console.log(
    `Você é ${username} (${playerId}), controlando o Time ${playerTeam}`,
  );
  */
  // A UI será atualizada quando allPlayersConnected ou waitingForOpponent for recebido
});

socket.on("opponentDisconnected", ({ timeout }) => {
  let timeLeft = timeout / 1000;
  disconnectionMessage.textContent = `Oponente desconectado. Retornando ao login em ${timeLeft} segundos se não reconectar.`;
  disconnectionMessage.classList.remove("hidden");
  disconnectionMessage.classList.add("visible");

  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
  }

  disconnectionCountdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(disconnectionCountdownInterval);
      disconnectionMessage.textContent = "";
      disconnectionMessage.classList.remove("visible");
      disconnectionMessage.classList.add("hidden");
    } else {
      disconnectionMessage.textContent = `Oponente desconectado. Retornando ao login em ${timeLeft} segundos se não reconectar.`;
    }
  }, 1000);
});

socket.on("opponentReconnected", () => {
  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
    disconnectionCountdownInterval = null;
  }
  disconnectionMessage.textContent = "Oponente reconectado!";
  setTimeout(() => {
    disconnectionMessage.classList.remove("visible");
    disconnectionMessage.classList.add("hidden");
    disconnectionMessage.textContent = "";
  }, 3000); // Limpa a mensagem após 3 segundos
});

socket.on("forceLogout", (message) => {
  alert(message);
  // Redefine a UI para a tela de login
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginScreen.classList.add("active");

  // Limpa o estado do jogo no lado do cliente
  activeChampions.clear();
  currentTurn = 1;
  playerId = null;
  playerTeam = null;
  username = null;
  playerNames.clear();

  // Redefine os elementos da tela de login
  usernameInput.value = "";
  usernameInput.disabled = false;
  joinArenaBtn.disabled = false;
  loginMessage.textContent = "Entre com seu nome de usuário para jogar.";

  // Limpa quaisquer mensagens/timers de desconexão
  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
    disconnectionCountdownInterval = null;
  }
  disconnectionMessage.classList.remove("visible");
  disconnectionMessage.classList.add("hidden");
  disconnectionMessage.textContent = "";

  // Opcionalmente, força um recarregamento completo da página ou reinicializa a conexão do socket, se necessário
  // socket.disconnect();
  // socket.connect();
});

socket.on("waitingForOpponent", (message) => {
  loginMessage.textContent = message;
  joinArenaBtn.disabled = true;
  usernameInput.disabled = true;
});

socket.on("allPlayersConnected", () => {
  loginScreen.classList.remove("active");
  loginScreen.classList.add("hidden");
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");

  // Anexa o listener do endTurnBtn aqui, depois que o mainContent estiver visível
  const endTurnButton = document.querySelector("#end-turn-btn");
  if (endTurnButton) {
    endTurnButton.addEventListener("click", endTurn);
    /*
    console.log(
      "[Client] Listener do endTurnBtn anexado após allPlayersConnected.",
    );
    */
  } else {
    /*
    console.error(
      "[Client] endTurnButton não encontrado após allPlayersConnected!",
    );
    */
  }

  // Redefine o estado de seleção do lado do cliente para o próximo jogo
  selectedChampions = Array(TEAM_SIZE).fill(null);
  playerTeamConfirmed = false;
  confirmTeamBtn.disabled = true;
  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
    championSelectionTimer = null;
  }
  gameEnded = false; // Redefine a flag de jogo terminado para um novo jogo

  // Oculta a sobreposição de fim de jogo se estiver ativa
  gameOverOverlay.classList.remove("active");
  gameOverOverlay.classList.add("hidden");
  gameOverOverlay.classList.remove("win-background", "lose-background"); // Limpa as classes de fundo

  const gameOverContent = gameOverOverlay.querySelector(".game-over-content");
  gameOverContent.classList.add("hidden"); // Garante que o conteúdo esteja oculto
  gameOverContent.classList.remove("win", "lose"); // Limpa as classes de conteúdo

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  returnToLoginBtn.onclick = null; // Limpa o listener de evento
});

socket.on("playerNamesUpdate", (namesArray) => {
  playerNames.clear();
  namesArray.forEach(([slot, name]) => playerNames.set(parseInt(slot), name));
  updatePlayerNamesUI();
});

function updatePlayerNamesUI() {
  const player1NameDisplayEl = document.getElementById("player1-name-display");
  const player2NameDisplayEl = document.getElementById("player2-name-display");
  const scoreTeam1El = document.getElementById("score-team-1");
  const scoreTeam2El = document.getElementById("score-team-2");

  const player1Name = playerNames.get(0);
  const player2Name = playerNames.get(1);

  if (player1NameDisplayEl) {
    if (playerTeam === 1) {
      player1NameDisplayEl.textContent = "Você";
    } else {
      player1NameDisplayEl.textContent = `Oponente (${player1Name || "Desconhecido"})`;
    }
  }
  if (player2NameDisplayEl) {
    if (playerTeam === 2) {
      player2NameDisplayEl.textContent = "Você";
    } else {
      player2NameDisplayEl.textContent = `Oponente (${player2Name || "Desconhecido"})`;
    }
  }

  // Inicializa as pontuações para 0
  if (scoreTeam1El) {
    scoreTeam1El.textContent = "0";
  }
  if (scoreTeam2El) {
    scoreTeam2El.textContent = "0";
  }
}

joinArenaBtn.addEventListener("click", () => {
  const enteredUsername = usernameInput.value.trim();
  if (enteredUsername) {
    username = enteredUsername;
    socket.emit("requestPlayerSlot", username);
    loginMessage.textContent = "Conectando...";
    joinArenaBtn.disabled = true;
    usernameInput.disabled = true;
  } else {
    loginMessage.textContent = "Por favor, digite um nome de usuário.";
  }
});

socket.on("serverFull", (message) => {
  alert(message);
  socket.disconnect();
});

socket.on("playerCountUpdate", (count) => {
  /*
  console.log(`Jogadores atuais: ${count}`);
  */
  // Atualiza a UI para mostrar a contagem de jogadores se necessário em outro lugar
});

socket.on("gameStateUpdate", (gameState) => {
  console.log("GAME STATE RECEBIDO:", gameState.champions);

  const existingChampionElements = new Map();
  document.querySelectorAll(".champion").forEach((el) => {
    existingChampionElements.set(el.dataset.championId, el);
  });

  // Atualiza ou cria campeões
  gameState.champions.forEach((championData) => {
    let champion = activeChampions.get(championData.id);
    if (champion) {
      // Se o campeão existe, mas seu elemento DOM está faltando, renderiza-o novamente
      if (!champion.el) {
        // console.warn(
        //   `[Client] Campeão ${champion.name} (ID: ${champion.id}) encontrado em activeChampions, mas faltando elemento DOM. Renderizando novamente.`,
        // );
        // Remove a instância antiga de activeChampions antes de criar uma nova
        activeChampions.delete(championData.id);
        champion = createNewChampion(championData); // Isso irá recriar e renderizar o elemento DOM e atualizar activeChampions
      }

      // Atualiza as propriedades do campeão existente
      champion.HP = championData.HP;
      champion.maxHP = championData.maxHP;
      champion.Attack = championData.Attack;
      champion.Defense = championData.Defense;
      champion.Speed = championData.Speed;
      champion.Critical = championData.Critical;
      champion.cooldowns = new Map(championData.cooldowns); // Garante que os cooldowns sejam atualizados
      champion.alive = championData.HP > 0; // Atualiza o status de vivo com base no HP

      champion.keywords = new Map(championData.keywords);

      champion.updateUI();
      existingChampionElements.delete(championData.id); // Marca como processado
    } else {
      // Cria novo campeão
      createNewChampion(championData);
    }
  });

  // Remove campeões que não existem mais no estado do jogo, a menos que estejam morrendo atualmente
  existingChampionElements.forEach((el, id) => {
    if (!dyingChampionIds.has(id)) {
      // Só remove se não estiver morrendo atualmente
      el.remove();
      activeChampions.delete(id);
    }
  });

  currentTurn = gameState.currentTurn;
  const turnDisplay = document.querySelector(".turn-display");
  const turnText = turnDisplay.querySelector("p");
  turnText.innerHTML = `Turno ${currentTurn}`;
});

socket.on("championAdded", (championData) => {
  // console.log("Campeão adicionado:", championData);
  // Nenhuma renderização direta aqui, gameStateUpdate irá lidar com isso
  // Apenas garantimos que os dados estejam disponíveis para gameStateUpdate
  if (!activeChampions.has(championData.id)) {
    const baseData = championDB[championData.championKey];
    if (!baseData) {
      // console.error(
      //   "Campeão inválido recebido do servidor:",
      //   championData.championKey,
      // );
      return;
    }
    const champion = new Champion({
      id: championData.id,
      team: championData.team,
      ...baseData,
    });
    activeChampions.set(champion.id, champion);
  }
});

socket.on("turnUpdate", (turn) => {
  currentTurn = turn;
  const turnDisplay = document.querySelector(".turn-display");
  const turnText = turnDisplay.querySelector("p");
  turnText.innerHTML = `Turno ${currentTurn}`;
  hasConfirmedEndTurn = false; // Redefine a confirmação para um novo turno
  endTurnBtn.disabled = false; // Reabilita o botão para um novo turno
  enableChampionActions(); // Reabilita todas as ações do campeão
  activeChampions.forEach((champion) => champion.resetActionStatus()); // Redefine o status de ação para todos os campeões
  activeChampions.forEach((champion) => {
    champion.updateUI(); // Atualiza a UI para todos os campeões
    // Espera DOM estabilizar
    requestAnimationFrame(() => {
      StatusIndicator.updateChampionIndicators(champion);
    });
  });
  logCombat(`Início do Turno ${currentTurn}`);
});

const CHAMPION_DEATH_ANIMATION_DURATION = 2000; // 2 segundos
const dyingChampionIds = new Set(); // Rastreia campeões atualmente em animação de morte

socket.on("championRemoved", (championId) => {
  console.log("Campeão removido:", championId);
  const championElement = document.querySelector(
    `[data-champion-id="${championId}"]`,
  );
  if (championElement) {
    console.log(
      `[Client] Iniciando animação de morte para o campeão ${championId}`,
    );
    championElement.classList.add("dying"); // Adiciona classe para acionar a animação
    dyingChampionIds.add(championId); // Marca o campeão como morrendo

    // Remove o elemento do DOM após a duração da animação
    setTimeout(() => {
      console.log(
        `[Client] Removendo elemento DOM para o campeão ${championId} após a animação`,
      );
      championElement.remove();
      dyingChampionIds.delete(championId); // Remove do conjunto de morrendo
    }, CHAMPION_DEATH_ANIMATION_DURATION);
  } else {
    console.log(
      `[Client] Nenhum elemento DOM encontrado para o campeão ${championId}`,
    );
  }
  const championInstance = activeChampions.get(championId);
  if (championInstance) {
    activeChampions.delete(championId);
  } else {
    console.warn(
      `[Client] Nenhuma instância de Campeão encontrada para o ID ${championId}`,
    );
  }
});

socket.on("skillDenied", (message) => {
  console.warn("[SkillDenied]", message);

  alert(message);
  // Se quiser algo mais elegante depois:
});

/*socket.on("actionFailed", (message) => {
  alert(`Ação falhou: ${message}`);
});*/

socket.on("skillApproved", async ({ userId, skillKey }) => {
  const user = activeChampions.get(userId);
  if (!user) return;

  const skill = user.skills.find((s) => s.key === skillKey);
  if (!skill) return;

  // Resolve seleção de alvos
  const targets = await collectClientTargets(user, skill);
  if (!targets) return;

  const targetIds = {};
  for (const role in targets) {
    targetIds[role] = targets[role].id;
  }

  // 🔥 Marca ação somente AGORA
  user.markActionTaken();
  user.updateUI();

  socket.emit("useSkill", {
    userId,
    skillKey,
    targetIds,
  });
});

socket.on("combatLog", (message) => {
  const text = typeof message === "string" ? message : message?.log;
  if (!text) return;
  logCombat(text);
});

/* document.addEventListener("click", (e) => {
  alert("TOQUE DETECTADO");
}, { passive: true }); */

const activeChampions = new Map();

let currentTurn = 1;

const arena = document.querySelector(".arena");
const endTurnBtn = document.querySelector("#end-turn-btn");
const backChampionDisplayTeam1 = document.getElementById(
  "backChampionDisplayTeam1",
);
const backChampionDisplayTeam2 = document.getElementById(
  "backChampionDisplayTeam2",
);

// Elementos da sobreposição de fim de jogo
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverMessage = document.getElementById("gameOverMessage");
const returnToLoginCountdown = document.getElementById(
  "returnToLoginCountdown",
);
const returnToLoginBtn = document.getElementById("returnToLoginBtn");

let countdownInterval = null;
const GAME_OVER_MESSAGE_DISPLAY_TIME = 10; // 10 segundos para a mensagem ficar visível
const RETURN_TO_LOGIN_TIME = 120; // 120 segundos para a contagem regressiva final

// --- Lógica de Seleção de Campeões ---

function renderAvailableChampions() {
  availableChampionsGrid.innerHTML = "";
  allAvailableChampionKeys = Object.keys(championDB);

  allAvailableChampionKeys.forEach((key) => {
    const champion = championDB[key];
    const card = document.createElement("div");
    card.classList.add("champion-card");
    card.dataset.championKey = key;
    card.draggable = true;

    card.innerHTML = `
      <img src="${champion.portrait}" alt="${champion.name}">
      <h3>${champion.name}</h3>
    `;

    card.addEventListener("click", () => handleChampionCardClick(key));
    card.addEventListener("dragstart", (e) => handleDragStart(e, key));

    availableChampionsGrid.appendChild(card);
  });
  updateSelectedChampionsUI();
}

function handleChampionCardClick(championKey) {
  if (playerTeamConfirmed) return;

  const index = selectedChampions.indexOf(championKey);
  if (index > -1) {
    // Campeão já selecionado, remove-o
    selectedChampions[index] = null;
  } else {
    // Campeão não selecionado, adiciona-o ao primeiro slot disponível
    const emptySlotIndex = selectedChampions.indexOf(null);
    if (emptySlotIndex > -1) {
      selectedChampions[emptySlotIndex] = championKey;
    } else {
      alert("Você já selecionou 3 campeões. Remova um para adicionar outro.");
    }
  }
  updateSelectedChampionsUI();
}

function updateSelectedChampionsUI() {
  selectedChampionsSlots.innerHTML = "";
  let allSlotsFilled = true;

  selectedChampions.forEach((championKey, index) => {
    const slot = document.createElement("div");
    slot.classList.add("champion-slot");
    slot.dataset.slotIndex = index;
    slot.addEventListener("dragover", handleDragOver);
    slot.addEventListener("drop", handleDrop);
    slot.addEventListener("dragleave", handleDragLeave);

    if (championKey) {
      const champion = championDB[championKey];
      slot.classList.add("has-champion");
      const card = document.createElement("div");
      card.classList.add("champion-card");
      card.dataset.championKey = championKey;
      card.draggable = true;
      card.innerHTML = `
        <img src="${champion.portrait}" alt="${champion.name}">
        <h3>${champion.name}</h3>
      `;
      card.addEventListener("click", () =>
        handleChampionCardClick(championKey),
      );
      card.addEventListener("dragstart", (e) =>
        handleDragStart(e, championKey, index),
      );
      slot.appendChild(card);
    } else {
      allSlotsFilled = false;
      slot.textContent = `Slot ${index + 1}`;
    }
    selectedChampionsSlots.appendChild(slot);
  });

  // Atualiza a grade de campeões disponíveis para refletir o estado selecionado
  document
    .querySelectorAll(".available-champions-grid .champion-card")
    .forEach((card) => {
      const key = card.dataset.championKey;
      if (selectedChampions.includes(key)) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

  confirmTeamBtn.disabled = !allSlotsFilled || playerTeamConfirmed;
}

let draggedFromSlotIndex = -1; // -1 se da grade disponível, caso contrário, índice em selectedChampions

function handleDragStart(e, championKey, fromSlotIndex = -1) {
  if (playerTeamConfirmed) {
    e.preventDefault();
    return;
  }
  draggedChampionKey = championKey;
  draggedFromSlotIndex = fromSlotIndex;
  e.dataTransfer.setData("text/plain", championKey);
  e.currentTarget.classList.add("dragging");
}

function handleDragOver(e) {
  e.preventDefault(); // Permite o drop
  if (playerTeamConfirmed) return;
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  if (playerTeamConfirmed) return;
  e.currentTarget.classList.remove("drag-over");

  const droppedChampionKey = e.dataTransfer.getData("text/plain");
  const targetSlotIndex = parseInt(e.currentTarget.dataset.slotIndex);

  if (isNaN(targetSlotIndex)) return;

  // Se estiver soltando em um slot vazio
  if (selectedChampions[targetSlotIndex] === null) {
    // Se arrastado da grade disponível
    if (draggedFromSlotIndex === -1) {
      const emptySlotIndex = selectedChampions.indexOf(null);
      if (emptySlotIndex > -1) {
        selectedChampions[targetSlotIndex] = droppedChampionKey;
      }
    } else {
      // Se arrastado de outro slot selecionado
      selectedChampions[targetSlotIndex] = droppedChampionKey;
      selectedChampions[draggedFromSlotIndex] = null;
    }
  } else {
    // Se estiver soltando em um slot ocupado, troca-os
    const temp = selectedChampions[targetSlotIndex];
    selectedChampions[targetSlotIndex] = droppedChampionKey;
    if (draggedFromSlotIndex !== -1) {
      selectedChampions[draggedFromSlotIndex] = temp;
    } else {
      // Se arrastado da grade disponível para um slot ocupado, remove o antigo do selecionado
      const oldChampionIndex = selectedChampions.indexOf(droppedChampionKey);
      if (oldChampionIndex > -1) {
        selectedChampions[oldChampionIndex] = null;
      }
    }
  }

  // Remove a classe dragging do elemento original
  document
    .querySelector(".champion-card.dragging")
    ?.classList.remove("dragging");
  draggedChampionKey = null;
  draggedFromSlotIndex = -1;
  updateSelectedChampionsUI();
}

confirmTeamBtn.addEventListener("click", () => {
  if (playerTeamConfirmed) return;
  if (selectedChampions.includes(null)) {
    alert("Por favor, selecione 3 campeões para sua equipe.");
    return;
  }
  playerTeamConfirmed = true;
  confirmTeamBtn.disabled = true;
  socket.emit("selectTeam", { team: playerTeam, champions: selectedChampions });
  teamSelectionMessage.textContent =
    "Equipe confirmada! Aguardando o outro jogador...";
  clearInterval(championSelectionTimer); // Para o timer
});

socket.on("startChampionSelection", ({ timeLeft }) => {
  championSelectionScreen.classList.remove("hidden");
  championSelectionScreen.classList.add("active");
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");

  allAvailableChampionKeys = Object.keys(championDB);
  renderAvailableChampions();

  championSelectionTimeLeft = timeLeft;
  updateChampionSelectionTimerUI();

  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
  }

  championSelectionTimer = setInterval(() => {
    championSelectionTimeLeft--;
    updateChampionSelectionTimerUI();
    if (championSelectionTimeLeft <= 0) {
      clearInterval(championSelectionTimer);
      if (!playerTeamConfirmed) {
        // Se o tempo acabar e o jogador não confirmou, envia a seleção atual
        // O servidor irá lidar com o preenchimento de campeões ausentes
        socket.emit("selectTeam", {
          team: playerTeam,
          champions: selectedChampions,
        });
        teamSelectionMessage.textContent =
          "Tempo esgotado! Equipe enviada. Aguardando o outro jogador...";
        playerTeamConfirmed = true;
        confirmTeamBtn.disabled = true;
      }
    }
  }, 1000);
});

function updateChampionSelectionTimerUI() {
  const minutes = Math.floor(championSelectionTimeLeft / 60);
  const seconds = championSelectionTimeLeft % 60;
  teamSelectionMessage.textContent = `Tempo restante para seleção: ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  if (playerTeamConfirmed) {
    teamSelectionMessage.textContent += " (Equipe confirmada!)";
  }
}

socket.on("allTeamsSelected", () => {
  championSelectionScreen.classList.remove("active");
  championSelectionScreen.classList.add("hidden");
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");
  // Redefine o estado de seleção do lado do cliente para o próximo jogo
  selectedChampions = Array(TEAM_SIZE).fill(null);
  playerTeamConfirmed = false;
  confirmTeamBtn.disabled = true;
  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
    championSelectionTimer = null;
  }
});

function createNewChampion(championData) {
  const baseData = championDB[championData.championKey];
  if (!baseData) {
    throw new Error("Campeão inválido");
  }

  const champion = new Champion({
    id: championData.id,
    team: championData.team,
    ...baseData,
  });

  activeChampions.set(champion.id, champion);

  const teamContainer = document.querySelector(`.team-${champion.team}`);
  champion.render(teamContainer, {
    onSkillClick: handleSkillUsage,
    onDelete: deleteChampion,
    onPortraitClick: handlePortraitClick,
    editMode,
  });

  return champion;
}

// -----------------------
// Relacionado à sobreposição do cartão/resumo do campeão

let portraitOverlay = null;

function handlePortraitClick(champion) {
  if (!champion) return;

  if (portraitOverlay) {
    closeOverlay();
  }

  portraitOverlay = createOverlay(champion);
  document.body.appendChild(portraitOverlay);

  requestAnimationFrame(() => {
    portraitOverlay.classList.add("active");
  });
}

function createOverlay(champion) {
  const overlay = document.createElement("div");
  overlay.classList.add("portrait-overlay");

  overlay.innerHTML = `
    <div class="portrait-overlay-content" role="dialog" aria-modal="true">
      <img class="portrait-overlay-img" src="${champion.portrait}" alt="${champion.name}">
      <h3 class="portrait-overlay-name">${champion.name}</h3>
    </div>
  `;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const toParagraphs = (text) => escapeHtml(text).replace(/\n/g, "<br>");

  const passive = champion?.passive;
  const passiveName = passive?.name ? `PASSIVA — ${passive.name}` : "PASSIVA";
  const passiveDesc =
    typeof passive?.description === "string" ? passive.description : "";

  const skills = Array.isArray(champion?.skills) ? champion.skills : [];

  const skillItemsHtml = [
    {
      name: passiveName,
      description: passiveDesc,
    },
    ...skills.map((s) => ({
      name: s?.name || "Habilidade",
      description: typeof s?.description === "string" ? s.description : "",
    })),
  ]
    .filter((s) => s.description || s.name)
    .map(
      (s) => `
        <div class="skill-detail">
          <div class="skill-name">${escapeHtml(s.name)}</div>
          <div class="skill-description">${toParagraphs(s.description)}</div>
        </div>
      `,
    )
    .join("");

  const details = document.createElement("div");
  details.classList.add("portrait-overlay-details");
  details.innerHTML = `
    <div class="portrait-overlay-details-content">
      <h3 class="portrait-overlay-details-title">Habilidades</h3>
      <div class="portrait-overlay-skill-list">
        ${skillItemsHtml}
      </div>
    </div>
  `;

  overlay.appendChild(details);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });

  const handleEsc = (e) => {
    if (e.key === "Escape") closeOverlay();
  };
  overlay._escHandler = handleEsc;
  document.addEventListener("keydown", handleEsc);

  return overlay;
}

function closeOverlay() {
  if (!portraitOverlay) return;

  portraitOverlay.classList.remove("active");

  if (portraitOverlay._escHandler) {
    document.removeEventListener("keydown", portraitOverlay._escHandler);
  }

  const toRemove = portraitOverlay;
  portraitOverlay = null;

  setTimeout(() => {
    toRemove.remove();
  }, 200);
}

// -----------------------
// Relacionado às estatísticas do campeão

// --------------------------------
// Relacionado ao uso de habilidades

function getSkillContext(button) {
  const userId = button.dataset.championId;
  const skillKey = button.dataset.skillKey;

  const user = activeChampions.get(userId);
  if (!user) return null;

  const skill = user.skills.find((s) => s.key === skillKey);
  if (!skill) return null;

  return { user, skill, userId, skillKey };
}

async function collectClientTargets(user, skill) {
  if (!Array.isArray(skill.targetSpec)) {
    // console.error("Habilidade sem targetSpec:", skill.name);
    return null;
  }

  const normalizedSpec = skill.targetSpec.map((s) =>
    typeof s === "string" ? { type: s } : s,
  );

  // Se há alvos globais, nenhuma seleção é necessária
  const hasGlobalTargets = skill.targetSpec.some(
    (spec) => spec === "all-enemies" || spec === "all-allies" || spec === "all",
  );

  if (hasGlobalTargets) {
    // Nenhuma seleção de alvo necessária, retorna objeto vazio
    // O servidor resolverá os alvos com base em allChampions
    return {};
  }

  const championsInField = Array.from(activeChampions.values());
  const targets = {};
  const enemyCounter = { count: 0 };
  const chosenTargets = new Set();
  let hasAtLeastOneTarget = false;

  for (const spec of normalizedSpec) {
    const target = await selectTargetForRole(
      spec.type,
      user,
      championsInField,
      enemyCounter,
      chosenTargets,
      spec.unique === true,
    );

    // Cancelou a habilidade inteira
    if (target === null) return null;

    // Slot opcional ignorado
    if (target === undefined) continue;

    Object.assign(targets, target);
    hasAtLeastOneTarget = true;
  }

  // Nenhum alvo, cancelou a habilidade inteira
  if (!hasAtLeastOneTarget) return null;

  return targets;
}

async function selectTargetForRole(
  role,
  user,
  championsInField,
  enemyCounter,
  chosenTargets,
  enforceUnique,
) {
  // helper pra aplicar filtro de unicidade
  const filterUnique = (list) => {
    if (!enforceUnique) return list;
    return list.filter((c) => !chosenTargets.has(c.id));
  };

  // 🔹 SELF
  if (role === "self") {
    chosenTargets.add(user.id);
    return { self: user };
  }

  // 🔹 ALLY automático
  if (role === "ally") {
    let allies = championsInField.filter(
      (c) => c.team === user.team && c.id !== user.id,
    );

    allies = filterUnique(allies);

    if (allies.length === 0) return undefined;

    chosenTargets.add(allies[0].id);
    return { ally: allies[0] };
  }

  // 🔹 SELECT ALLY
  if (role === "select:ally") {
    let candidates = championsInField.filter((c) => c.team === user.team);

    candidates = filterUnique(candidates);

    if (candidates.length === 0) return null;

    const target = await createTargetSelectionOverlay(
      candidates,
      "Escolha um Aliado (ou você)",
    );

    if (!target) return undefined;

    chosenTargets.add(target.id);
    return { ally: target };
  }

  // 🔹 ALL ALLIES (inclui self)
  if (role === "all:ally") {
    let allies = championsInField.filter((c) => c.team === user.team);

    allies = filterUnique(allies);

    if (allies.length === 0) return undefined;

    allies.forEach((c) => chosenTargets.add(c.id));

    return { allies };
  }

  // 🔹 ENEMY
  if (role === "enemy") {
    enemyCounter.count++;
    const index = enemyCounter.count;

    let candidates = championsInField.filter((c) => c.team !== user.team);

    candidates = filterUnique(candidates);

    if (candidates.length === 0) return null;

    const target = await createTargetSelectionOverlay(
      candidates,
      index === 1 ? "Selecione o INIMIGO" : `Selecione o INIMIGO ${index}`,
    );

    if (!target) return null;

    chosenTargets.add(target.id);

    const key = index === 1 ? "enemy" : `enemy${index}`;
    return { [key]: target };
  }

  // 🔹 FALLBACK GENÉRICO
  let candidates = filterUnique(championsInField);

  if (candidates.length === 0) return null;

  const target = await createTargetSelectionOverlay(
    candidates,
    `Selecione o alvo (${role})`,
  );

  if (!target) return undefined;

  chosenTargets.add(target.id);
  return { [role]: target };
}

function createTargetSelectionOverlay(candidates, title) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.classList.add("targetSelectionOverlay");

    const h2 = document.createElement("h2");
    h2.textContent = title;
    overlay.appendChild(h2);

    const container = document.createElement("div");
    container.classList.add("target-candidates");

    candidates.forEach((champion) => {
      const card = document.createElement("div");
      card.classList.add("target-candidate");

      card.innerHTML = `
                <img src="${champion.portrait}" alt="${champion.name}">
                <h3>${champion.name}</h3>
                <p>HP: ${champion.HP}/${champion.maxHP}</p>
            `;

      card.addEventListener("click", (e) => {
        e.stopPropagation(); // Impede o clique na sobreposição
        closeTargetOverlay(overlay);
        resolve(champion);
      });

      container.appendChild(card);
    });

    overlay.appendChild(container);

    // Clique fora para cancelar
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeTargetOverlay(overlay);
        resolve(null);
      }
    });

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("active");
    });
  });
}

function closeTargetOverlay(overlay) {
  overlay.classList.remove("active");
  setTimeout(() => {
    overlay.remove();
  }, 200);
}

async function handleSkillUsage(button) {
  if (gameEnded) {
    alert("O jogo já terminou. Nenhuma ação pode ser realizada.");
    return;
  }

  const ctx = getSkillContext(button);
  if (!ctx) return;

  const { user, skill, userId, skillKey } = ctx;

  if (user.team !== playerTeam) {
    alert("Você só pode usar habilidades de campeões do seu time.");
    return;
  }

  if (!editMode && user.hasActedThisTurn) {
    alert(`${user.name} já agiu neste turno.`);
    return;
  }
  // ⭐ NOVO: pedir autorização ao servidor
  socket.emit("requestSkillUse", {
    userId,
    skillKey,
  });
}

// variável auxiliar para rastreaer headers de turno no log
let lastLoggedTurn = null;

function logCombat(text) {
  const log = document.getElementById("combat-log");
  if (!log) return;

  let turnHeader;

  if (lastLoggedTurn !== currentTurn) {
    // criar o header de turno
    lastLoggedTurn = currentTurn;
    turnHeader = document.createElement("h2");
    turnHeader.classList.add("turn-header");
    turnHeader.textContent = `Turno ${currentTurn}`;
    log.appendChild(turnHeader);
  }

  // colocar uma quebra de linha antes de line.innerHTML se já houver linhas no log
  if (log.children.length > 1) {
    const br = document.createElement("br");
    log.appendChild(br);
  }

  const line = document.createElement("p");
  line.innerHTML = text.replace(/\n/g, "<br>");

  turnHeader = log.querySelector(".turn-header");

  log.appendChild(line);
}

// --------------------------------

function endTurn() {
  // console.log("[Client] Função 'endTurn' chamada.");
  if (hasConfirmedEndTurn) {
    alert("Você já confirmou o fim do turno. Aguardando o outro jogador.");
    // console.log("[Client] endTurn: Já confirmado neste turno.");
    return;
  }
  const confirmed = confirm("Tem certeza que deseja encerrar este turno?");
  if (!confirmed) {
    // console.log("[Client] endTurn: Usuário cancelou.");
    return;
  }
  // console.log(
  //   "[Client] Emitindo evento 'endTurn'. hasConfirmedEndTurn atual:",
  //   hasConfirmedEndTurn,
  //   "endTurnBtn.disabled:",
  //   endTurnBtn.disabled,
  // );
  socket.emit("endTurn");
  hasConfirmedEndTurn = true;
  endTurnBtn.disabled = true; // Desabilita o botão após a confirmação
  disableChampionActions(); // Desabilita todas as ações do campeão
  logCombat("Você confirmou o fim do turno. Aguardando o outro jogador...");
}

function deleteChampion(championId) {
  const champion = activeChampions.get(championId);
  if (!(champion instanceof Champion)) {
    console.error("Campeão não encontrado.");
    return;
  }
  if (champion.team !== playerTeam) {
    alert("Você só pode remover campeões do seu time.");
    return;
  }
  if (confirm("Tem certeza que deseja remover este campeão?")) {
    socket.emit("removeChampion", { championId });
  }
}

// ----------------------------------------//
// Listeners de eventos //

socket.on("playerConfirmedEndTurn", (playerSlot) => {
  const playerName = playerNames.get(playerSlot);
  if (playerSlot !== playerTeam - 1) {
    // Se for o oponente que confirmou
    logCombat(
      `${playerName} confirmou o fim do turno. Aguardando sua confirmação.`,
    );
  }
});

socket.on("waitingForOpponentEndTurn", (message) => {
  logCombat(message);
});

socket.on("scoreUpdate", ({ player1, player2 }) => {
  const scoreTeam1El = document.getElementById("score-team-1");
  const scoreTeam2El = document.getElementById("score-team-2");

  if (scoreTeam1El) {
    scoreTeam1El.textContent = player1;
  }
  if (scoreTeam2El) {
    scoreTeam2El.textContent = player2;
  }
});

socket.on("gameOver", ({ winnerTeam, winnerName }) => {
  gameEnded = true; // Garante que a flag gameEnded esteja definida
  endTurnBtn.disabled = true;
  disableChampionActions();

  const isWinner = playerTeam === winnerTeam;

  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverContent = document.getElementById("gameOverContent");
  const gameOverMessage = document.getElementById("gameOverMessage");

  // Exibe a sobreposição de fim de jogo
  gameOverOverlay.classList.remove("hidden");
  gameOverOverlay.classList.add("active");

  // Aplica a classe de fundo à própria sobreposição
  gameOverOverlay.classList.add(
    isWinner ? "win-background" : "lose-background",
  );
  gameOverOverlay.classList.remove(
    isWinner ? "lose-background" : "win-background",
  );

  gameOverContent.classList.add(isWinner ? "win" : "lose");
  gameOverContent.classList.remove(isWinner ? "lose" : "win");
  gameOverContent.classList.remove("hidden"); // Garante que o conteúdo esteja visível inicialmente

  gameOverMessage.textContent = isWinner ? "VITÓRIA!" : "DERROTA!";

  setTimeout(() => {
    // Esconde a sobreposição de vitória/derrota
    gameOverOverlay.classList.remove("active");
    gameOverOverlay.classList.add("hidden");

    // Mostra a pequena sobreposição do timer
    const timerOverlay = document.getElementById("timerOverlay");
    const returnToLoginCountdown = document.getElementById(
      "returnToLoginCountdown",
    );
    const returnToLoginBtn = document.getElementById("returnToLoginBtn");

    timerOverlay.classList.remove("hidden");
    timerOverlay.classList.add("active");

    // Inicia a contagem regressiva de 120s
    let finalCountdownTime = RETURN_TO_LOGIN_TIME;
    returnToLoginCountdown.textContent = `Voltando à página inicial em ${finalCountdownTime} segundos...`;

    countdownInterval = setInterval(() => {
      finalCountdownTime--;
      if (finalCountdownTime <= 0) {
        clearInterval(countdownInterval);
        window.location.reload();
      } else {
        returnToLoginCountdown.textContent = `Voltando à página inicial em ${finalCountdownTime} segundos...`;
      }
    }, 1000);

    // Botão para voltar manualmente
    returnToLoginBtn.onclick = () => {
      clearInterval(countdownInterval);
      window.location.reload();
    };
  }, GAME_OVER_MESSAGE_DISPLAY_TIME * 1000);

  logCombat(
    `Fim de jogo! ${winnerName} (Time ${winnerTeam}) venceu a partida!`,
  );
});

socket.on("backChampionUpdate", ({ team, championKey }) => {
  const displayElement =
    team === 1 ? backChampionDisplayTeam1 : backChampionDisplayTeam2;
  if (!displayElement) {
    // console.error(
    //   `[Client] Elemento de exibição do campeão de trás não encontrado para o time ${team}`,
    // );
    return;
  }

  if (championKey) {
    const champion = championDB[championKey];
    if (champion) {
      displayElement.innerHTML = `
        <img src="${champion.portrait}" alt="${champion.name}">
        <p>${champion.name}</p>
      `;
      displayElement.classList.remove("hidden");
      displayElement.classList.add("visible");
    } else {
      // console.error(`[Client] Dados do campeão não encontrados para a chave: ${championKey}`);
      displayElement.classList.add("hidden");
      displayElement.classList.remove("visible");
    }
  } else {
    // Nenhum campeão de trás, oculta a exibição
    displayElement.innerHTML = "";
    displayElement.classList.add("hidden");
    displayElement.classList.remove("visible");
  }
});

function disableChampionActions() {
  document.querySelectorAll(".skill-btn").forEach((button) => {
    button.disabled = true;
  });
  // Referências a championSelectBar comentadas foram removidas, pois não estão definidas.
}

function enableChampionActions() {
  document.querySelectorAll(".skill-btn").forEach((button) => {
    button.disabled = false;
  });
  // Referências a championSelectBar comentadas foram removidas, pois não estão definidas.
}
