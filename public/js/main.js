// ============================================================
//  OVERLAY DE SKILL (HOVER/TOUCH NOS BOTÕES DE SKILL)
// ============================================================

import elementEmoji from "../../shared/champions/elementEmoji.js";

let skillOverlay = null;
let skillOverlayTimeout = null;

function showSkillOverlay(button, skill, champion) {
  removeSkillOverlay();
  if (!button || !skill) return;

  // Overlay element
  const overlay = document.createElement("div");
  overlay.className = "skill-hover-overlay";

  // Helper: escape HTML
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Helper: paragraphs
  const toParagraphs = (text) => escapeHtml(text).replace(/\n/g, "<br>");

  // Cost
  let cost = champion?.getSkillCost ? champion.getSkillCost(skill) : skill.cost;
  let costType =
    skill.energyCost !== undefined
      ? "EN"
      : skill.manaCost !== undefined
        ? "MP"
        : "-";
  if (cost === undefined) cost = "-";

  overlay.innerHTML = `
  <div class="skill-overlay-content">

    <div class="skill-overlay-title">
      ${escapeHtml(skill.name || "Habilidade")}
    </div>

    <div class="skill-overlay-meta-primary">
      <div class="skill-meta-item">
        <span class="meta-label">Custo: </span>
        <span class="meta-value">${cost} ${costType}</span>
      </div>

      ${
        skill.bf
          ? `
        <div class="skill-meta-item">
          <span class="meta-label">BF: </span>
          <span class="meta-value">${skill.bf}%</span>
        </div>
      `
          : ""
      }
    </div>

    ${
      skill.element
        ? `
      <div class="skill-overlay-element-row">
        <span class="meta-label">Elemento</span>
        <span class="meta-value">
          ${elementEmoji[skill.element] || skill.element}
        </span>
      </div>
    `
        : ""
    }

    <div class="skill-overlay-contact-row">
      <span class="meta-label">Contato</span>
      <span class="meta-value">${skill.contact ? "✅" : "❌"}</span>
    </div>

    <div class="skill-overlay-desc">
      ${toParagraphs(
        typeof skill.description === "function"
          ? skill.description.call(skill)
          : skill.description || "",
      )}
    </div>

  </div>
`;

  document.body.appendChild(overlay);
  skillOverlay = overlay;

  // Position overlay near button (above or below depending on space)
  const rect = button.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left + rect.width / 2 - overlayRect.width / 2;
  // If not enough space below, show above
  if (top + overlayRect.height > window.innerHeight) {
    top = rect.top - overlayRect.height - 8;
  }
  // Clamp left
  left = Math.max(8, Math.min(left, window.innerWidth - overlayRect.width - 8));
  overlay.style.position = "fixed";
  overlay.style.top = `${Math.max(8, top)}px`;
  overlay.style.left = `${left}px`;
  overlay.style.zIndex = 15000;

  // Fade in
  requestAnimationFrame(() => overlay.classList.add("active"));
}

function removeSkillOverlay() {
  if (skillOverlay) {
    skillOverlay.classList.remove("active");
    const toRemove = skillOverlay;
    skillOverlay = null;
    setTimeout(() => toRemove.remove(), 150);
  }
  if (skillOverlayTimeout) {
    clearTimeout(skillOverlayTimeout);
    skillOverlayTimeout = null;
  }
}

// ============================================================
//  IMPORTS
// ============================================================

import { championDB } from "/shared/data/championDB.js";
import { Champion } from "/shared/core/Champion.js";
import { StatusIndicator } from "/shared/core/statusIndicator.js";
import { createCombatAnimationManager } from "./animation/animsAndLogManager.js";

// ============================================================
//  SOCKET
// ============================================================

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

// ============================================================
//  CONFIGURAÇÃO (sobrescrita pelo servidor via "editModeUpdate")
//  Apenas propriedades de UI/UX — o server filtra campos sensíveis
//  como damageOutput antes de enviar.
// ============================================================

const editMode = {
  enabled: false,
  autoLogin: false,
  autoSelection: false,
  actMultipleTimesPerTurn: false,
  unreleasedChampions: false,
};

// ============================================================
//  ESTADO DO JOGO
// ============================================================

// --- Identidade do jogador ---
let playerId = null;
let playerTeam = null;
let username = null;
const playerNames = new Map(); // slot → nome de usuário

// --- Turno & combate ---
let currentTurn = 1;
let hasConfirmedEndTurn = false;
let gameEnded = false;

// --- Campeões ativos em campo ---
const activeChampions = new Map();

// --- Seleção de campeões ---
const TEAM_SIZE = 3;
let selectedChampions = Array(TEAM_SIZE).fill(null);
let championSelectionTimer = null;
let championSelectionTimeLeft = 0;
let playerTeamConfirmed = false;
let allAvailableChampionKeys = [];
let draggedChampionKey = null;
let draggedFromSlotIndex = -1; // -1 = grade disponível, >= 0 = slot selecionado

// --- Temporizadores ---
let disconnectionCountdownInterval = null;
let countdownInterval = null;

// --- Overlays ---
let portraitOverlay = null;

// ============================================================
//  REFERÊNCIAS DO DOM
// ============================================================

// --- Tela de login ---
const loginScreen = document.getElementById("login-screen");
const usernameInput = document.getElementById("username-input");
const joinArenaBtn = document.getElementById("join-arena-btn");
const loginMessage = document.getElementById("login-message");
const disconnectionMessage = document.getElementById("disconnection-message");

// --- Conteúdo principal (arena) ---
const mainContent = document.getElementById("main-content");
const endTurnBtn = document.querySelector("#end-turn-btn");
const combatDialog = document.getElementById("combat-dialog");
const combatDialogText = document.getElementById("combat-dialog-text");
const backChampionDisplayTeam1 = document.getElementById(
  "backChampionDisplayTeam1",
);
const backChampionDisplayTeam2 = document.getElementById(
  "backChampionDisplayTeam2",
);

// --- Seleção de campeões ---
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

// --- Fim de jogo ---
const gameOverOverlay = document.getElementById("gameOverOverlay");
const returnToLoginBtn = document.getElementById("returnToLoginBtn");

// --- Surrender ---
const surrenderBtn = document.getElementById("surrender-btn");
const surrenderOverlay = document.getElementById("surrender-overlay");
const surrenderCancel = document.getElementById("surrender-cancel");
const surrenderConfirm = document.getElementById("surrender-confirm");

// ============================================================
//  EXPORTS GLOBAIS (usados por animsAndLogManager e outros)
// ============================================================

window.StatusIndicator = StatusIndicator;
window.gameEnded = gameEnded;

// ============================================================
//  GERENCIADOR DE ANIMAÇÕES DE COMBATE
// ============================================================

const combatAnimations = createCombatAnimationManager({
  activeChampions,
  createNewChampion,
  getCurrentTurn: () => currentTurn,
  setCurrentTurn: (turn) => {
    currentTurn = turn;
  },
  updateTurnDisplay,
  applyTurnUpdate,
  startStatusIndicatorRotation: (champions) =>
    StatusIndicator.startRotationLoop(champions),
  combatDialog,
  combatDialogText,

  onQueueEmpty: () => {
    socket.emit("combatAnimationsFinished");
  },
});

// ============================================================
//  LOGIN & CONEXÃO
// ============================================================

socket.on("connect", () => {
  if (editMode.enabled && editMode.autoLogin) {
    username = "EditUser";
    socket.emit("requestPlayerSlot", username);
  }
});

socket.on("editModeUpdate", (serverEditMode = {}) => {
  Object.assign(editMode, serverEditMode);
  // Auto-login in edit mode: if server enabled autoLogin, fill username and join
  try {
    if (
      editMode.enabled &&
      editMode.autoLogin &&
      usernameInput &&
      joinArenaBtn &&
      loginScreen.classList.contains("active") &&
      !playerId
    ) {
      const storedName =
        localStorage.getItem("dev_username") ||
        serverEditMode.autoLoginName ||
        "dev";
      usernameInput.value = storedName;
      // simulate user clicking the join button
      joinArenaBtn.click();
    }
  } catch (e) {
    console.warn("Auto-login failed:", e);
  }
});

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

socket.on("playerAssigned", (data) => {
  playerId = data.playerId;
  playerTeam = data.team;
  username = data.username;
  window.playerTeam = playerTeam;
});

socket.on("waitingForOpponent", (message) => {
  loginMessage.textContent = message;
  joinArenaBtn.disabled = true;
  usernameInput.disabled = true;
});

socket.on("serverFull", (message) => {
  alert(message);
  socket.disconnect();
});

socket.on("allPlayersConnected", () => {
  // Transição: login → conteúdo principal
  loginScreen.classList.remove("active");
  loginScreen.classList.add("hidden");
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");

  // Anexa o listener de fim de turno (usa a ref já existente)
  if (endTurnBtn) {
    endTurnBtn.addEventListener("click", endTurn);
  }

  // Reseta estado de seleção para novo jogo
  selectedChampions = Array(TEAM_SIZE).fill(null);
  playerTeamConfirmed = false;
  confirmTeamBtn.disabled = true;
  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
    championSelectionTimer = null;
  }

  // Reseta flags do jogo
  gameEnded = false;
  window.gameEnded = false;

  // Reseta botão de surrender
  if (surrenderBtn) surrenderBtn.disabled = false;
  closeSurrenderDialog();

  // Oculta sobreposição de fim de jogo
  gameOverOverlay.classList.remove(
    "active",
    "win-background",
    "lose-background",
  );
  gameOverOverlay.classList.add("hidden");

  const gameOverContent = gameOverOverlay.querySelector(".game-over-content");
  gameOverContent.classList.add("hidden");
  gameOverContent.classList.remove("win", "lose");

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  returnToLoginBtn.onclick = null;

  combatAnimations.reset();
});

socket.on("forceLogout", (message) => {
  alert(message);

  // Volta para a tela de login
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginScreen.classList.add("active");

  // Limpa todo o estado do jogo
  activeChampions.clear();
  currentTurn = 1;
  playerId = null;
  playerTeam = null;
  username = null;
  playerNames.clear();

  // Reseta elementos de login
  usernameInput.value = "";
  usernameInput.disabled = false;
  joinArenaBtn.disabled = false;
  loginMessage.textContent = "Entre com seu nome de usuário para jogar.";

  // Limpa timers de desconexão
  if (disconnectionCountdownInterval) {
    clearInterval(disconnectionCountdownInterval);
    disconnectionCountdownInterval = null;
  }
  disconnectionMessage.classList.remove("visible");
  disconnectionMessage.classList.add("hidden");
  disconnectionMessage.textContent = "";

  combatAnimations.reset();
});

// ============================================================
//  DESCONEXÃO / RECONEXÃO DO OPONENTE
// ============================================================

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
  }, 3000);
});

// ============================================================
//  NOMES DOS JOGADORES & PLACAR
// ============================================================

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
    player1NameDisplayEl.textContent =
      playerTeam === 1 ? "Você" : `Oponente (${player1Name || "Desconhecido"})`;
  }
  if (player2NameDisplayEl) {
    player2NameDisplayEl.textContent =
      playerTeam === 2 ? "Você" : `Oponente (${player2Name || "Desconhecido"})`;
  }

  if (scoreTeam1El) scoreTeam1El.textContent = "0";
  if (scoreTeam2El) scoreTeam2El.textContent = "0";
}

socket.on("scoreUpdate", ({ player1, player2 }) => {
  const scoreTeam1El = document.getElementById("score-team-1");
  const scoreTeam2El = document.getElementById("score-team-2");
  if (scoreTeam1El) scoreTeam1El.textContent = player1;
  if (scoreTeam2El) scoreTeam2El.textContent = player2;
});

// ============================================================
//  SELEÇÃO DE CAMPEÕES
// ============================================================

socket.on("startChampionSelection", ({ timeLeft }) => {
  championSelectionScreen.classList.remove("hidden");
  championSelectionScreen.classList.add("active");
  mainContent.classList.remove("visible");
  mainContent.classList.add("hidden");

  renderAvailableChampions();

  championSelectionTimeLeft = timeLeft;
  updateChampionSelectionTimerUI();

  if (championSelectionTimer) clearInterval(championSelectionTimer);

  championSelectionTimer = setInterval(() => {
    championSelectionTimeLeft--;
    updateChampionSelectionTimerUI();
    if (championSelectionTimeLeft <= 0) {
      clearInterval(championSelectionTimer);
      if (!playerTeamConfirmed) {
        // Tempo esgotado — envia a seleção atual; servidor preenche ausentes
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

socket.on("allTeamsSelected", () => {
  championSelectionScreen.classList.remove("active");
  championSelectionScreen.classList.add("hidden");
  mainContent.classList.remove("hidden");
  mainContent.classList.add("visible");

  // Reseta estado de seleção
  selectedChampions = Array(TEAM_SIZE).fill(null);
  playerTeamConfirmed = false;
  confirmTeamBtn.disabled = true;
  if (championSelectionTimer) {
    clearInterval(championSelectionTimer);
    championSelectionTimer = null;
  }
});

confirmTeamBtn.addEventListener("click", () => {
  if (playerTeamConfirmed) return;
  if (selectedChampions.includes(null)) {
    alert("Por favor, selecione seus campeões para a equipe.");
    return;
  }
  playerTeamConfirmed = true;
  confirmTeamBtn.disabled = true;
  socket.emit("selectTeam", { team: playerTeam, champions: selectedChampions });
  teamSelectionMessage.textContent =
    "Equipe confirmada! Aguardando o outro jogador...";
  clearInterval(championSelectionTimer);
});

// --- Renderização da grade de campeões ---

// Função para ordenar campeões por ordem alfabética
function sortChampionKeysAlphabetically(keys) {
  return keys.sort((a, b) => {
    const nameA = championDB[a]?.name?.toLowerCase() || "";
    const nameB = championDB[b]?.name?.toLowerCase() || "";
    return nameA.localeCompare(nameB);
  });
}

function renderAvailableChampions() {
  availableChampionsGrid.innerHTML = "";

  // Filtra campeões válidos
  let allAvailableChampionKeys = Object.keys(championDB).filter((key) => {
    const champion = championDB[key];
    const isChampion = (champion.entityType ?? "champion") === "champion";
    const isUnreleased = champion.unreleased === true;
    if (!isChampion) return false;
    if (isUnreleased && !editMode.unreleasedChampions) return false;
    return true;
  });

  // Ordena por ordem alfabética
  allAvailableChampionKeys = sortChampionKeysAlphabetically(
    allAvailableChampionKeys,
  );

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

// --- Clique em card de campeão ---

function handleChampionCardClick(championKey) {
  if (playerTeamConfirmed) return;

  const index = selectedChampions.indexOf(championKey);
  if (index > -1) {
    selectedChampions[index] = null;
  } else {
    const emptySlotIndex = selectedChampions.indexOf(null);
    if (emptySlotIndex > -1) {
      selectedChampions[emptySlotIndex] = championKey;
    } else {
      alert(
        "Todos os slots estão preenchidos. Remova um para adicionar outro.",
      );
    }
  }
  updateSelectedChampionsUI();
}

// --- Atualização visual dos slots selecionados ---

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

  // Marca os cards na grade disponível como selecionados
  document
    .querySelectorAll(".available-champions-grid .champion-card")
    .forEach((card) => {
      const key = card.dataset.championKey;
      card.classList.toggle("selected", selectedChampions.includes(key));
    });

  confirmTeamBtn.disabled = !allSlotsFilled || playerTeamConfirmed;
}

// --- Drag & Drop ---

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
  e.preventDefault();
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

  if (selectedChampions[targetSlotIndex] === null) {
    // Soltando em slot vazio
    if (draggedFromSlotIndex === -1) {
      selectedChampions[targetSlotIndex] = droppedChampionKey;
    } else {
      selectedChampions[targetSlotIndex] = droppedChampionKey;
      selectedChampions[draggedFromSlotIndex] = null;
    }
  } else {
    // Soltando em slot ocupado — troca
    const temp = selectedChampions[targetSlotIndex];
    selectedChampions[targetSlotIndex] = droppedChampionKey;
    if (draggedFromSlotIndex !== -1) {
      selectedChampions[draggedFromSlotIndex] = temp;
    } else {
      const oldChampionIndex = selectedChampions.indexOf(droppedChampionKey);
      if (oldChampionIndex > -1) {
        selectedChampions[oldChampionIndex] = null;
      }
    }
  }

  document
    .querySelector(".champion-card.dragging")
    ?.classList.remove("dragging");
  draggedChampionKey = null;
  draggedFromSlotIndex = -1;
  updateSelectedChampionsUI();
}

// --- Timer de seleção ---

function updateChampionSelectionTimerUI() {
  const minutes = Math.floor(championSelectionTimeLeft / 60);
  const seconds = championSelectionTimeLeft % 60;
  teamSelectionMessage.textContent = `Tempo restante para seleção: ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  if (playerTeamConfirmed) {
    teamSelectionMessage.textContent += " (Equipe confirmada!)";
  }
}

// ============================================================
//  GERENCIAMENTO DE CAMPEÕES
// ============================================================

socket.on("championAdded", (championData) => {
  // Pré-registra o campeão para que gameStateUpdate possa utilizá-lo
  if (activeChampions.has(championData.id)) return;

  const baseData = championDB[championData.championKey];
  if (!baseData) return;

  const champion = Champion.fromBaseData(
    baseData,
    championData.id,
    championData.team,
  );
  champion.baseAttack = baseData.Attack;
  champion.baseDefense = baseData.Defense;
  champion.baseSpeed = baseData.Speed;
  champion.baseCritical = baseData.Critical;
  champion.baseLifeSteal = baseData.LifeSteal;
  activeChampions.set(champion.id, champion);
});

socket.on("championRemoved", (championId) => {
  combatAnimations.handleChampionRemoved(championId);
});

/** Cria e renderiza um novo campeão no campo de batalha. */
function createNewChampion(championData) {
  const baseData = championDB[championData.championKey];
  if (!baseData) throw new Error("Campeão inválido");

  const champion = Champion.fromBaseData(
    baseData,
    championData.id,
    championData.team,
  );
  champion.baseAttack = baseData.Attack;
  champion.baseDefense = baseData.Defense;
  champion.baseSpeed = baseData.Speed;
  champion.baseCritical = baseData.Critical;
  champion.baseLifeSteal = baseData.LifeSteal;

  activeChampions.set(champion.id, champion);

  const teamContainer = document.querySelector(`.team-${champion.team}`);
  champion.render(teamContainer, {
    onSkillClick: handleSkillUsage,
    onDelete: deleteChampion,
    onPortraitClick: handlePortraitClick,
    // Adiciona overlay de hover/touch no retrato
    onPortraitHover: (champ) => showQuickStatsOverlay(champ),
    onPortraitHoverOut: hideQuickStatsOverlay,
    // Adiciona overlay de hover/touch nas skills
    showSkillOverlay: showSkillOverlay,
    removeSkillOverlay: removeSkillOverlay,
    editMode: editMode.enabled,
  });

  // Adiciona listeners para hover/touch no retrato
  setTimeout(() => {
    const el = teamContainer.querySelector(
      `.champion[data-champion-id='${champion.id}'] .portrait`,
    );
    if (el) {
      // Desktop: hover
      el.addEventListener("mouseenter", (e) => {
        if (window.ontouchstart === undefined) showQuickStatsOverlay(champion);
      });
      el.addEventListener("mouseleave", (e) => {
        if (window.ontouchstart === undefined) hideQuickStatsOverlay();
      });
      // Mobile: touch
      el.addEventListener(
        "touchstart",
        (e) => {
          showQuickStatsOverlay(champion);
          e.stopPropagation();
        },
        { passive: true },
      );
      el.addEventListener(
        "touchend",
        (e) => {
          hideQuickStatsOverlay();
          e.stopPropagation();
        },
        { passive: true },
      );
    }
  }, 0);

  return champion;
}

/*   */
// Overlay de stats rápidos (hover/touch no retrato)
let quickStatsOverlay = null;

function showQuickStatsOverlay(champion) {
  hideQuickStatsOverlay();
  if (!champion) return;

  quickStatsOverlay = document.createElement("div");
  quickStatsOverlay.className = "quick-stats-overlay";
  quickStatsOverlay.style.position = "fixed";
  quickStatsOverlay.style.zIndex = 13000;
  quickStatsOverlay.style.pointerEvents = "none";

  const statRows = [];

  // HP (texto)
  statRows.push({
    label: "HP",
    value: `${champion.HP}/${champion.maxHP}`,
  });

  // Numéricos baseados em comparação
  statRows.push({
    label: "Ataque",
    value: champion.Attack,
    base: champion.baseAttack,
  });

  statRows.push({
    label: "Defesa",
    value: champion.Defense,
    base: champion.baseDefense,
  });

  statRows.push({
    label: "Velocidade",
    value: champion.Speed,
    base: champion.baseSpeed,
  });

  statRows.push({
    label: "Evasão",
    value: champion.Evasion ?? 0,
    base: champion.baseEvasion,
    percent: true,
  });

  statRows.push({
    label: "Crítico",
    value: champion.Critical ?? 0,
    base: champion.baseCritical,
    percent: true,
  });

  statRows.push({
    label: "Roubo de Vida",
    value: champion.LifeSteal ?? 0,
    base: champion.baseLifeSteal,
    percent: true,
  });

  let html = `<div class='quick-stats-content'>`;
  html += `<div class='quick-stats-title'>${champion.name}</div>`;
  html += `<div class='quick-stats-list'>`;

  for (const row of statRows) {
    let color = "#fff";
    let displayValue = row.value;

    if (typeof row.base === "number" && typeof row.value === "number") {
      if (row.value > row.base) color = "#00ff66";
      else if (row.value < row.base) color = "#ff2a2a";

      if (row.percent) {
        displayValue = `${row.value}%`;
      }
    }

    html += `
      <div class='quick-stat-row'>
        <span class='quick-stat-label'>${row.label}:</span>
        <span class='quick-stat-value' style='color:${color}'>
          ${displayValue}
        </span>
      </div>
    `;
  }

  html += `</div></div>`;

  quickStatsOverlay.innerHTML = html;
  document.body.appendChild(quickStatsOverlay);

  const portrait = document.querySelector(
    `.champion[data-champion-id='${champion.id}'] .portrait`,
  );

  if (portrait) {
    const rect = portrait.getBoundingClientRect();
    const overlayRect = quickStatsOverlay.getBoundingClientRect();

    let top = rect.top - overlayRect.height - 8;
    if (top < 0) top = rect.bottom + 8;

    let left = rect.left + (rect.width - overlayRect.width) / 2;
    if (left < 8) left = 8;

    if (left + overlayRect.width > window.innerWidth) {
      left = window.innerWidth - overlayRect.width - 8;
    }

    quickStatsOverlay.style.top = `${top}px`;
    quickStatsOverlay.style.left = `${left}px`;
  }
}

function hideQuickStatsOverlay() {
  if (quickStatsOverlay) {
    quickStatsOverlay.remove();
    quickStatsOverlay = null;
  }
}

/** Remove um campeão do time local (edit mode / debug). */
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

// ============================================================
//  OVERLAY DE RETRATO / INFORMAÇÕES DO CAMPEÃO
// ============================================================

function handlePortraitClick(champion) {
  if (!champion) return;
  if (portraitOverlay) closeOverlay();

  portraitOverlay = createOverlay(champion);
  document.body.appendChild(portraitOverlay);
  requestAnimationFrame(() => portraitOverlay.classList.add("active"));
}

function createOverlay(champion) {
  const overlay = document.createElement("div");
  overlay.classList.add("portrait-overlay");

  // --- Helpers de sanitização ---
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  overlay.innerHTML = `
    <div class="portrait-overlay-content" role="dialog" aria-modal="true">
      <img class="portrait-overlay-img"
          src="${escapeHtml(champion.portrait)}"
          alt="${escapeHtml(champion.name)}">

      <h3 class="portrait-overlay-name">
        ${escapeHtml(champion.name)}
      </h3>
    </div>
  `;

  const toParagraphs = (text) => escapeHtml(text).replace(/\n/g, "<br>");

  // --- Lista de habilidades (passiva + skills) ---
  const passive = champion?.passive;
  const passiveName = passive?.name ? `PASSIVA — ${passive.name}` : "PASSIVA";
  const passiveDesc =
    typeof passive?.description === "function"
      ? passive.description()
      : typeof passive?.description === "string"
        ? passive.description
        : "";

  let passiveItemHtml = "";

  if (passiveDesc) {
    passiveItemHtml = `
    <div class="portrait-overlay-skill">
      <h4 class="portrait-overlay-skill-name">
        ${escapeHtml(passiveName)}
      </h4>
      <p class="portrait-overlay-skill-desc">
        ${toParagraphs(passiveDesc)}
      </p>
    </div>
  `;
  }

  // atributos do campeão (p.Ex: ATQ, DEF ,etc...)
  const statsItemHtml = [
    { name: "Ataque", value: champion.Attack },
    { name: "Defesa", value: champion.Defense },
    { name: "Velocidade", value: champion.Speed },
    { name: "Evasão", value: champion.Evasion ?? 0 },
    { name: "Crítico", value: champion.Critical ?? 0 },
    { name: "Roubo de Vida", value: champion.LifeSteal ?? 0 },
  ]
    .filter((item) => item.value !== undefined)
    .map(
      (item) => `
        <div class="portrait-overlay-stat">
          <h4 class="portrait-overlay-stat-name">${escapeHtml(item.name)}: </h4>
          <p class="portrait-overlay-stat-value">${escapeHtml(item.value)}</p>
        </div>
      `,
    )
    .join("");

  const details = document.createElement("div");
  details.classList.add("portrait-overlay-details");
  details.innerHTML = `
    <div class="portrait-overlay-details-content">
      <h3 class="portrait-overlay-details-title">Passiva & Atributos</h3>
      <div class="portrait-overlay-skills-list">
        ${passiveItemHtml}
      </div>
      <div class="portrait-overlay-stats-list">
        ${statsItemHtml}
      </div>
    </div>
  `;

  overlay.appendChild(details);

  // Fechar ao clicar no backdrop
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });

  // Fechar com Escape
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
  setTimeout(() => toRemove.remove(), 200);
}

// ============================================================
//  USO DE HABILIDADES & SELEÇÃO DE ALVOS
// ============================================================

/** Extrai o contexto (campeão + skill) a partir de um botão de habilidade. */
function getSkillContext(button) {
  const userId = button.dataset.championId;
  const skillKey = button.dataset.skillKey;

  const user = activeChampions.get(userId);
  if (!user) return null;

  const skill = user.skills.find((s) => s.key === skillKey);
  if (!skill) return null;

  return { user, skill, userId, skillKey };
}

/** Handler principal: valida e solicita uso de habilidade ao servidor. */
async function handleSkillUsage(button) {
  if (window.gameEnded) {
    alert("O jogo já terminou. Nenhuma ação pode ser realizada.");
    return;
  }

  if (button.disabled) return;

  const ctx = getSkillContext(button);
  if (!ctx) return;

  const { user, userId, skillKey, skill } = ctx;

  if (user.team !== playerTeam) {
    alert("Você só pode usar habilidades de campeões do seu time.");
    return;
  }

  if (!editMode.actMultipleTimesPerTurn && user.hasActedThisTurn) {
    alert(`${user.name} já agiu neste turno.`);
    return;
  }

  const resourceState = user.getResourceState();
  const cost = user.getSkillCost(skill);
  if (cost > resourceState.current) {
    alert(
      resourceState.type === "energy" ? "EN insuficiente." : "MP insuficiente.",
    );
    user.updateUI(currentTurn);
    return;
  }

  // Solicita autorização ao servidor antes de resolver alvos
  socket.emit("requestSkillUse", { userId, skillKey });
}

socket.on("skillDenied", (message) => {
  console.warn("[SkillDenied]", message);
  alert(message);
});

socket.on("skillApproved", async ({ userId, skillKey }) => {
  const user = activeChampions.get(userId);
  if (!user) return;

  const skill = user.skills.find((s) => s.key === skillKey);
  if (!skill) return;

  // Coleta alvos no client
  const targets = await collectClientTargets(user, skill);
  if (!targets) return;

  const targetIds = {};
  for (const role in targets) {
    targetIds[role] = targets[role].id;
  }

  // Marca a ação somente após resolução de alvos
  user.markActionTaken();
  user.updateUI(currentTurn);

  socket.emit("useSkill", { userId, skillKey, targetIds });
});

// --- Coleta de alvos no client ---

async function collectClientTargets(user, skill) {
  if (!skill || !Array.isArray(skill.targetSpec)) return null;

  const normalizedSpec = skill.targetSpec.map((s) =>
    typeof s === "string" ? { type: s } : s,
  );

  // Alvos globais não precisam de seleção manual
  const hasGlobalTargets = skill.targetSpec.some(
    (spec) => spec === "all-enemies" || spec === "all-allies" || spec === "all",
  );
  if (hasGlobalTargets) return {};

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

    if (target === null) return null; // Cancelou a habilidade
    if (target === undefined) continue; // Slot opcional ignorado

    Object.assign(targets, target);
    hasAtLeastOneTarget = true;
  }

  return hasAtLeastOneTarget ? targets : null;
}

async function selectTargetForRole(
  role,
  user,
  championsInField,
  enemyCounter,
  chosenTargets,
  enforceUnique,
) {
  // Helper: filtra alvos já escolhidos quando unicidade é exigida
  const filterUnique = (list) =>
    enforceUnique ? list.filter((c) => !chosenTargets.has(c.id)) : list;

  // SELF
  if (role === "self") {
    chosenTargets.add(user.id);
    return { self: user };
  }

  // ALLY (automático — primeiro aliado disponível)
  if (role === "ally") {
    let allies = championsInField.filter(
      (c) => c.team === user.team && c.id !== user.id,
    );
    allies = filterUnique(allies);
    if (allies.length === 0) return undefined;
    chosenTargets.add(allies[0].id);
    return { ally: allies[0] };
  }

  // SELECT ALLY (seleção manual)
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

  // ALL ALLIES (inclui self — servidor resolve)
  if (role === "all:ally") return {};

  // ENEMY (seleção manual)
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

  // FALLBACK genérico
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

// --- Overlay de seleção de alvo ---

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
        e.stopPropagation();
        closeTargetOverlay(overlay);
        resolve(champion);
      });
      container.appendChild(card);
    });

    overlay.appendChild(container);

    // Clique fora cancela a seleção
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeTargetOverlay(overlay);
        resolve(null);
      }
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("active"));
  });
}

function closeTargetOverlay(overlay) {
  overlay.classList.remove("active");
  setTimeout(() => overlay.remove(), 200);
}

// ============================================================
//  GERENCIAMENTO DE TURNOS
// ============================================================

socket.on("gameStateUpdate", (gameState) => {
  combatAnimations.handleGameStateUpdate(gameState);
});

socket.on("turnUpdate", (turn) => {
  combatAnimations.handleTurnUpdate(turn);
});

/** Aplica a transição de turno no client: reseta ações e atualiza a UI. */
function applyTurnUpdate(turn) {
  currentTurn = turn;
  updateTurnDisplay(currentTurn);
  hasConfirmedEndTurn = false;
  endTurnBtn.disabled = false;
  enableChampionActions();

  activeChampions.forEach((champion) => champion.resetActionStatus());
  activeChampions.forEach((champion) => {
    champion.updateUI(currentTurn);
    requestAnimationFrame(() =>
      StatusIndicator.updateChampionIndicators(champion),
    );
  });

  logCombat(`Início do Turno ${currentTurn}`);
}

function updateTurnDisplay(turn) {
  const turnDisplay = document.querySelector(".turn-display");
  const turnText = turnDisplay?.querySelector("p");
  if (turnText) turnText.innerHTML = `Turno ${turn}`;
}

function endTurn() {
  if (hasConfirmedEndTurn) {
    alert("Você já confirmou o fim do turno. Aguardando o outro jogador.");
    return;
  }

  const confirmed = confirm("Tem certeza que deseja encerrar este turno?");
  if (!confirmed) return;

  socket.emit("endTurn");
  hasConfirmedEndTurn = true;
  endTurnBtn.disabled = true;
  disableChampionActions();
  logCombat("Você confirmou o fim do turno. Aguardando o outro jogador...");
}

socket.on("playerConfirmedEndTurn", (playerSlot) => {
  const playerName = playerNames.get(playerSlot);
  if (playerSlot !== playerTeam - 1) {
    logCombat(
      `${playerName} confirmou o fim do turno. Aguardando sua confirmação.`,
    );
  }
});

socket.on("waitingForOpponentEndTurn", (message) => {
  logCombat(message);
});

// ============================================================
//  LOG DE COMBATE
// ============================================================

socket.on("combatAction", (envelope) => {
  combatAnimations.handleCombatAction(envelope);
});

socket.on("combatLog", (message) => {
  if (typeof message === "string") {
    combatAnimations.handleCombatLog(message);
  }
});

function logCombat(text) {
  if (typeof text !== "string" || !text) return;
  combatAnimations.handleCombatLog(text);
}

// ============================================================
//  EXIBIÇÃO DO CAMPEÃO DE RETAGUARDA (não utilizado atualmente, mas pode ser reativado futuramente)
// ============================================================

/* socket.on("backChampionUpdate", ({ team, championKey }) => {
  const displayElement =
    team === 1 ? backChampionDisplayTeam1 : backChampionDisplayTeam2;
  if (!displayElement) return;

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
      displayElement.classList.add("hidden");
      displayElement.classList.remove("visible");
    }
  } else {
    displayElement.innerHTML = "";
    displayElement.classList.add("hidden");
    displayElement.classList.remove("visible");
  }
}); */

// ============================================================
//  HELPERS DE UI (habilitar / desabilitar habilidades)
// ============================================================

function disableChampionActions() {
  document.querySelectorAll(".skill-btn").forEach((button) => {
    button.disabled = true;
  });
}

function enableChampionActions() {
  document.querySelectorAll(".skill-btn").forEach((button) => {
    button.disabled = false;
  });
}

// ============================================================
//  SURRENDER (Render-se)
// ============================================================

function openSurrenderDialog() {
  if (gameEnded || !playerTeam) return;
  surrenderOverlay.classList.remove("hidden");
  surrenderOverlay.classList.add("active");
}

function closeSurrenderDialog() {
  surrenderOverlay.classList.remove("active");
  surrenderOverlay.classList.add("hidden");
}

function confirmSurrender() {
  closeSurrenderDialog();
  surrenderBtn.disabled = true;
  socket.emit("surrender");
}

if (surrenderBtn) surrenderBtn.addEventListener("click", openSurrenderDialog);
if (surrenderCancel)
  surrenderCancel.addEventListener("click", closeSurrenderDialog);
if (surrenderConfirm)
  surrenderConfirm.addEventListener("click", confirmSurrender);

// Close on overlay backdrop click
if (surrenderOverlay) {
  surrenderOverlay.addEventListener("click", (e) => {
    if (e.target === surrenderOverlay) closeSurrenderDialog();
  });
}

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    surrenderOverlay &&
    surrenderOverlay.classList.contains("active")
  ) {
    closeSurrenderDialog();
  }
});
