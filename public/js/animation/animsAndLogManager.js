export function createCombatAnimationManager({
  activeChampions,
  createNewChampion,
  getCurrentTurn,
  setCurrentTurn,
  updateTurnDisplay,
  applyTurnUpdate,
  startStatusIndicatorRotation,
  combatDialog,
  combatDialogText,
} = {}) {
  const ctx = buildCombatAnimationContext({
    activeChampions,
    createNewChampion,
    getCurrentTurn,
    setCurrentTurn,
    updateTurnDisplay,
    applyTurnUpdate,
    startStatusIndicatorRotation,
    combatDialog,
    combatDialogText,
  });

  return {
    applyGameStateUpdate: (gameState) => applyGameStateUpdate(ctx, gameState),
    enqueueCombatItem: (item) => enqueueCombatItem(ctx, item),
    processCombatLogPayload: (payload) => processCombatLogPayload(ctx, payload),
    handleChampionRemoved: (championId) =>
      handleChampionRemoved(ctx, championId),
    handleGameStateUpdate: (gameState) => handleGameStateUpdate(ctx, gameState),
    handleTurnUpdate: (turn) => handleTurnUpdate(ctx, turn),
    reset: () => resetManager(ctx),
  };
}

function buildCombatAnimationContext(options) {
  const ctx = {
    ...options,
    durations: {
      CHAMPION_DEATH_ANIMATION_DURATION: 2000,
      DAMAGE_ANIMATION_DURATION: 958,
      EVASION_ANIMATION_DURATION: 550,
      HEAL_ANIMATION_DURATION: 900,
      SHIELD_ANIMATION_DURATION: 900,
      GAME_OVER_DELAY: 550,
    },
    dialogSpeed: {
      base: 1000,
      perChar: 25,
      max: 4500,
    },
    dyingChampionIds: new Set(),
    removedChampionIds: new Set(),
    deathPendingIds: new Set(),
    lastKnownHP: new Map(),
    championVisualTimers: new Map(),
    combatQueue: [],
    combatQueueTimer: null,
    combatQueueRunning: false,
    pendingGameState: null,
    pendingTurnUpdate: null,
    gameOverTriggered: false,
    gameOverShown: false,
    shouldStopQueue: false,
    gameOverPayloadReceived: false,
    pendingGameOverEvent: null,
    compactStateCache: new Map(),
  };

  ctx.eventHandlers = createEventHandlers(ctx);

  return ctx;
}

function createEventHandlers(ctx) {
  return {
    evasion: (event) =>
      triggerChampionVisual(
        ctx,
        event?.targetId,
        "evasion",
        ctx.durations.EVASION_ANIMATION_DURATION,
      ),
    damage: (event) => {
      triggerChampionVisual(
        ctx,
        event?.targetId,
        "damage",
        ctx.durations.DAMAGE_ANIMATION_DURATION,
      );
      triggerChampionDamage(event?.targetId, event?.amount);
    },
    heal: (event) => {
      triggerChampionVisual(
        ctx,
        event?.targetId,
        "heal",
        ctx.durations.HEAL_ANIMATION_DURATION,
      );
      triggerChampionHeal(event?.targetId, event?.amount);
    },
    shield: (event) => {
      triggerChampionVisual(
        ctx,
        event?.targetId,
        "shield",
        ctx.durations.SHIELD_ANIMATION_DURATION,
      );
      triggerChampionShield(event?.targetId, event?.amount);
    },
    death: (event) => triggerChampionDeath(ctx, event?.targetId),
    gameOver: (event) => triggerGameOver(ctx, event),
  };
}

function hasGameOverEvent(events) {
  return (
    Array.isArray(events) && events.some((event) => event?.type === "gameOver")
  );
}

function resolveChampionName(ctx, championId, fallback) {
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  if (!championId) return "Campeao";
  return ctx.activeChampions.get(championId)?.name || "Campeao";
}

function buildDialogFromEvents(ctx, events = []) {
  if (!Array.isArray(events) || events.length === 0) return null;

  const lines = [];

  for (const event of events) {
    if (!event || !event.type) continue;

    switch (event.type) {
      case "skill": {
        const userName = resolveChampionName(
          ctx,
          event.userId || event.sourceId,
          event.userName,
        );
        const targetName = resolveChampionName(
          ctx,
          event.targetId,
          event.targetName,
        );
        if (userName && event.skillName && event.targetId) {
          lines.push(`${userName} usou ${event.skillName} em ${targetName}.`);
        } else if (userName && event.skillName) {
          lines.push(`${userName} usou ${event.skillName}.`);
        }
        break;
      }

      case "damage": {
        // const targetName = resolveChampionName(
        //   ctx,
        //   event.targetId,
        //   event.targetName,
        // );
        // if (targetName && Number.isFinite(event.amount)) {
        //   lines.push(`${targetName} sofreu ${event.amount} de dano.`);
        // }
        break;
      }

      case "heal": {
        const targetName = resolveChampionName(
          ctx,
          event.targetId,
          event.targetName,
        );
        if (targetName) {
          // lines.push(`${targetName} recuperou ${event.amount} de vida.`);
          lines.push(`${targetName} recuperou vida.`);
        }
        break;
      }

      case "shield": {
        const targetName = resolveChampionName(
          ctx,
          event.targetId,
          event.targetName,
        );
        if (targetName) {
          // lines.push(`${targetName} recebeu ${event.amount} de escudo.`);
          lines.push(`${targetName} foi protegido com um escudo.`);
        }
        break;
      }

      case "death": {
        const targetName = resolveChampionName(
          ctx,
          event.targetId,
          event.targetName,
        );
        if (targetName) {
          lines.push(`${targetName} foi derrotado.`);
        }
        break;
      }

      case "keywordApplied": {
        const targetName = resolveChampionName(
          ctx,
          event.targetId,
          event.targetName,
        );
        if (targetName && event.keyword) {
          lines.push(`${targetName} está ${event.keyword}.`);
        }
        break;
      }

      case "keywordRemoved": {
        const targetName = resolveChampionName(
          ctx,
          event.targetId,
          event.targetName,
        );
        if (targetName && event.keyword) {
          lines.push(`${targetName} não está mais ${event.keyword}.`);
        }
        break;
      }

      case "gameOver":
        if (event.winnerName) {
          lines.push(`Fim de jogo! ${event.winnerName} venceu.`);
        }
        break;

      case "score":
        if (event.playerName) {
          lines.push(`${event.playerName} pontuou.`);
        }
        break;
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function enqueueCombatItem(ctx, item) {
  const events = item.events;
  const hasGameOver = hasGameOverEvent(events);

  if ((ctx.shouldStopQueue || ctx.gameOverPayloadReceived) && !hasGameOver) {
    return;
  }

  if (ctx.gameOverPayloadReceived && hasGameOver && ctx.gameOverTriggered) {
    return;
  }

  if (events.length > 1) {
    events.forEach((event) => {
      ctx.combatQueue.push({
        events: [event],
        state: item.state,
      });
    });
  } else {
    ctx.combatQueue.push(item);
  }

  if (!ctx.combatQueueRunning) {
    processCombatQueue(ctx);
  }
}

function handleChampionRemoved(ctx, championId) {
  if (ctx.shouldStopQueue || ctx.gameOverPayloadReceived) return;
  ctx.removedChampionIds.add(championId);
  ctx.deathPendingIds.add(championId);
  enqueueCombatItem(ctx, {
    events: [{ type: "death", targetId: championId }],
  });
}

function handleGameStateUpdate(ctx, gameState) {
  if (ctx.shouldStopQueue || ctx.gameOverPayloadReceived) return;
  if (ctx.combatQueueRunning || ctx.combatQueue.length > 0) {
    ctx.pendingGameState = gameState;
    return;
  }

  applyGameStateUpdate(ctx, gameState);
}

function handleTurnUpdate(ctx, turn) {
  if (ctx.shouldStopQueue || ctx.gameOverPayloadReceived) return;
  if (ctx.combatQueueRunning || ctx.combatQueue.length > 0) {
    ctx.pendingTurnUpdate = turn;
    return;
  }

  ctx.applyTurnUpdate?.(turn);
}

function resetManager(ctx) {
  ctx.combatQueue.length = 0;
  ctx.combatQueueRunning = false;
  ctx.pendingGameState = null;
  ctx.pendingTurnUpdate = null;
  ctx.gameOverTriggered = false;
  ctx.gameOverShown = false;
  ctx.shouldStopQueue = false;
  ctx.gameOverPayloadReceived = false;
  ctx.pendingGameOverEvent = null;

  if (ctx.combatQueueTimer) {
    clearTimeout(ctx.combatQueueTimer);
    ctx.combatQueueTimer = null;
  }

  for (const timer of ctx.championVisualTimers.values()) {
    clearTimeout(timer);
  }
  ctx.championVisualTimers.clear();

  ctx.dyingChampionIds.clear();
  ctx.removedChampionIds.clear();
  ctx.deathPendingIds.clear();
  ctx.lastKnownHP.clear();
  ctx.compactStateCache.clear();

  hideCombatDialog(ctx);
}

const STAT_LABELS = {
  Attack: "Ataque",
  Defense: "Defesa",
  Speed: "Velocidade",
  Critical: "Critico",
  LifeSteal: "Roubo de Vida",
};

function extractKeywordSet(keywordEntries) {
  if (!Array.isArray(keywordEntries)) return new Set();
  return new Set(
    keywordEntries
      .map((entry) => entry?.[0])
      .filter((name) => typeof name === "string" && name.trim().length > 0),
  );
}

function formatKeywordLabel(keyword) {
  const value = String(keyword || "")
    .replace(/_/g, " ")
    .trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getCompactStateLogs(ctx, stateList) {
  if (!Array.isArray(stateList) || stateList.length === 0) return [];

  const logs = [];

  stateList.forEach((championData) => {
    const id = championData?.id;
    if (!id) return;

    const name = championData?.name || "Campeao";
    const currentKeywords = extractKeywordSet(championData?.keywords);
    const currentStats = {
      Attack: championData?.Attack,
      Defense: championData?.Defense,
      Speed: championData?.Speed,
      Critical: championData?.Critical,
      LifeSteal: championData?.LifeSteal,
    };

    const previous = ctx.compactStateCache.get(id);

    if (previous) {
      const addedKeywords = Array.from(currentKeywords).filter(
        (keyword) => !previous.keywords.has(keyword),
      );
      const removedKeywords = Array.from(previous.keywords).filter(
        (keyword) => !currentKeywords.has(keyword),
      );

      addedKeywords.forEach((keyword) => {
        const label = formatKeywordLabel(keyword);
        if (label) {
          logs.push(`Status: ${name} ficou ${label}.`);
        }
      });

      removedKeywords.forEach((keyword) => {
        const label = formatKeywordLabel(keyword);
        if (label) {
          logs.push(`Status: ${name} nao esta mais ${label}.`);
        }
      });

      Object.keys(STAT_LABELS).forEach((statName) => {
        const prevValue = previous.stats?.[statName];
        const nextValue = currentStats?.[statName];

        if (!Number.isFinite(prevValue) || !Number.isFinite(nextValue)) return;
        if (nextValue > prevValue) {
          logs.push(`Buff: ${name} ${STAT_LABELS[statName]} aumentou.`);
        } else if (nextValue < prevValue) {
          logs.push(`Debuff: ${name} ${STAT_LABELS[statName]} diminuiu.`);
        }
      });
    }

    ctx.compactStateCache.set(id, {
      keywords: currentKeywords,
      stats: currentStats,
      name,
    });
  });

  return logs;
}

function processCombatLogPayload(ctx, payload) {
  const normalized = typeof payload === "string" ? { log: payload } : payload;
  if (!normalized || typeof normalized !== "object") return null;

  if (!Array.isArray(normalized.events)) {
    normalized.events = normalized.event ? [normalized.event] : [];
  }

  const hasGameOver = hasGameOverEvent(normalized.events);

  if (ctx.gameOverPayloadReceived) {
    if (!hasGameOver || ctx.gameOverTriggered) return null;
  } else if (hasGameOver) {
    ctx.gameOverPayloadReceived = true;
    if (typeof window !== "undefined") {
      window.gameOverPayloadReceived = true;
    }
  }

  let logText = normalized.log || null;
  const stateLines = getCompactStateLogs(ctx, normalized.state);

  if (stateLines.length > 0) {
    logText = logText
      ? `${logText}\n${stateLines.join("\n")}`
      : stateLines.join("\n");
  }

  enqueueCombatItem(ctx, {
    events: normalized.events,
    state: normalized.state || null,
  });

  return logText;
}

function applyGameStateUpdate(ctx, gameState) {
  if (!gameState) return;

  ctx.setCurrentTurn?.(gameState.currentTurn);
  ctx.updateTurnDisplay?.(gameState.currentTurn);

  const existingChampionElements = new Map();
  document.querySelectorAll(".champion").forEach((el) => {
    existingChampionElements.set(el.dataset.championId, el);
  });

  gameState.champions.forEach((championData) => {
    if (ctx.dyingChampionIds.has(championData.id)) {
      return;
    }

    const isRemoved = ctx.removedChampionIds.has(championData.id);
    const isDeathPending = ctx.deathPendingIds.has(championData.id);

    if (isRemoved && !isDeathPending) {
      return;
    }

    let champion = ctx.activeChampions.get(championData.id);
    if (champion) {
      if (!champion.el) {
        if (isRemoved) {
          return;
        }

        ctx.activeChampions.delete(championData.id);
        champion = ctx.createNewChampion(championData);
      }

      syncChampionFromData(ctx, champion, championData);
      existingChampionElements.delete(championData.id);
    } else {
      if (isRemoved) {
        return;
      }

      const newChampion = ctx.createNewChampion(championData);
      syncChampionFromData(ctx, newChampion, championData);
    }
  });

  existingChampionElements.forEach((el, id) => {
    if (!ctx.dyingChampionIds.has(id) && !ctx.deathPendingIds.has(id)) {
      el.remove();
      ctx.activeChampions.delete(id);
      ctx.lastKnownHP.delete(id);
    }
  });

  ctx.startStatusIndicatorRotation?.(Array.from(ctx.activeChampions.values()));
}

function syncChampionFromData(ctx, champion, championData) {
  const currentTurn = ctx.getCurrentTurn?.() ?? 1;

  champion.HP = championData.HP;
  champion.maxHP = championData.maxHP;
  champion.Attack = championData.Attack;
  champion.Defense = championData.Defense;
  champion.Speed = championData.Speed;
  champion.Critical = championData.Critical;
  champion.LifeSteal = championData.LifeSteal;
  champion.cooldowns = new Map(championData.cooldowns || []);
  champion.alive = championData.HP > 0;
  champion.keywords = new Map(championData.keywords || []);

  if (championData.runtime) {
    champion.runtime = {
      ...champion.runtime,
      shields: Array.isArray(championData.runtime.shields)
        ? championData.runtime.shields
        : [],
    };
  }

  champion.updateUI(currentTurn);

  ctx.lastKnownHP.set(championData.id, championData.HP);
}

function applyCombatStateSnapshots(ctx, stateList) {
  if (!Array.isArray(stateList) || stateList.length === 0) return;

  stateList.forEach((championData) => {
    if (ctx.dyingChampionIds.has(championData.id)) {
      return;
    }

    const isRemoved = ctx.removedChampionIds.has(championData.id);
    const isDeathPending = ctx.deathPendingIds.has(championData.id);

    if (isRemoved && !isDeathPending) {
      return;
    }

    let champion = ctx.activeChampions.get(championData.id);

    if (!champion) {
      if (isRemoved) {
        return;
      }

      champion = ctx.createNewChampion(championData);
    } else if (!champion.el) {
      if (isRemoved) {
        return;
      }

      ctx.activeChampions.delete(championData.id);
      champion = ctx.createNewChampion(championData);
    }

    syncChampionFromData(ctx, champion, championData);
  });

  ctx.startStatusIndicatorRotation?.(Array.from(ctx.activeChampions.values()));
}

function processCombatQueue(ctx) {
  if (ctx.combatQueueTimer) {
    clearTimeout(ctx.combatQueueTimer);
    ctx.combatQueueTimer = null;
  }

  if (ctx.shouldStopQueue) {
    ctx.combatQueueRunning = false;
    ctx.combatQueue.length = 0;
    ctx.pendingGameState = null;
    ctx.pendingTurnUpdate = null;
    hideCombatDialog(ctx);
    showFinalGameOver(ctx);
    return;
  }

  if (ctx.combatQueue.length === 0) {
    ctx.combatQueueRunning = false;
    hideCombatDialog(ctx);

    if (!ctx.gameOverPayloadReceived && ctx.pendingGameState) {
      applyGameStateUpdate(ctx, ctx.pendingGameState);
    }
    ctx.pendingGameState = null;

    if (!ctx.gameOverPayloadReceived && ctx.pendingTurnUpdate !== null) {
      ctx.applyTurnUpdate?.(ctx.pendingTurnUpdate);
    }
    ctx.pendingTurnUpdate = null;

    return;
  }

  ctx.combatQueueRunning = true;

  const item = ctx.combatQueue.shift();
  const events = Array.isArray(item?.events) ? item.events : [];
  const state = item?.state;

  let eventIndex = 0;

  function processNextEvent() {
    if (eventIndex >= events.length) {
      processCombatQueue(ctx);
      return;
    }

    const event = events[eventIndex++];
    const handler = ctx.eventHandlers[event?.type];

    // 🔹 1️⃣ Mostrar diálogo (todo evento tem texto)
    const dialogText = buildDialogFromEvents(ctx, [event]);

    if (dialogText) {
      showCombatDialog(ctx, dialogText);
    }

    let duration = getCombatDialogDuration(ctx, dialogText);

    // 🔹 2️⃣ Executar animação específica
    if (handler) {
      handler(event);
    }

    // 🔹 3️⃣ Sincronizar snapshot no momento correto
    if (event.type === "damage") {
      duration = Math.max(duration, ctx.durations.DAMAGE_ANIMATION_DURATION);

      setTimeout(() => {
        applyCombatStateSnapshots(ctx, state);
      }, ctx.durations.DAMAGE_ANIMATION_DURATION * 0.6);
    } else if (event.type === "heal") {
      duration = Math.max(duration, ctx.durations.HEAL_ANIMATION_DURATION);

      setTimeout(() => {
        applyCombatStateSnapshots(ctx, state);
      }, ctx.durations.HEAL_ANIMATION_DURATION * 0.5);
    } else {
      // Eventos como skill, death, shield, keyword, etc.
      applyCombatStateSnapshots(ctx, state);
    }

    // 🔹 4️⃣ Ir para próximo evento após o tempo correto
    ctx.combatQueueTimer = setTimeout(() => {
      processNextEvent();
    }, duration || 450);
  }

  processNextEvent();
}

function moveDeathItemToEnd(ctx, targetId) {
  const index = ctx.combatQueue.findIndex((entry) =>
    entry?.events?.some((e) => e?.type === "death" && e.targetId === targetId),
  );

  if (index === -1) return;

  const [deathItem] = ctx.combatQueue.splice(index, 1);
  ctx.combatQueue.push(deathItem);
}

function getCombatDialogDuration(ctx, text) {
  if (!text) return 450;

  const length = stripHtml(text).trim().length;

  return Math.min(
    ctx.dialogSpeed.max,
    ctx.dialogSpeed.base + length * ctx.dialogSpeed.perChar,
  );
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, "");
}

function showCombatDialog(ctx, text) {
  if (!ctx.combatDialog || !ctx.combatDialogText) return;

  ctx.combatDialogText.innerHTML = String(text).replace(/\n/g, "<br>");
  ctx.combatDialog.classList.remove("hidden", "leaving");
  ctx.combatDialog.classList.add("active");
}

function hideCombatDialog(ctx) {
  if (!ctx.combatDialog) return;

  if (!ctx.combatDialog.classList.contains("active")) {
    ctx.combatDialog.classList.add("hidden");
    ctx.combatDialog.classList.remove("leaving");
    return;
  }

  ctx.combatDialog.classList.remove("active");
  ctx.combatDialog.classList.add("leaving");

  setTimeout(() => {
    ctx.combatDialog.classList.add("hidden");
    ctx.combatDialog.classList.remove("leaving");
  }, 200);
}

function triggerChampionVisual(ctx, championId, className, durationMs) {
  const champion = ctx.activeChampions.get(championId);
  const element =
    champion?.el ||
    document.querySelector(`[data-champion-id="${championId}"]`);

  if (!element) return;

  const timerKey = `${championId}:${className}`;
  const existingTimer = ctx.championVisualTimers.get(timerKey);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);

  if (Number.isFinite(durationMs) && durationMs > 0) {
    const timer = setTimeout(() => {
      element.classList.remove(className);
      ctx.championVisualTimers.delete(timerKey);
    }, durationMs);

    ctx.championVisualTimers.set(timerKey, timer);
  }
}

function triggerChampionDeath(ctx, championId) {
  const champion = ctx.activeChampions.get(championId);
  const element =
    champion?.el ||
    document.querySelector(`[data-champion-id="${championId}"]`);

  if (!element) return;

  if (ctx.dyingChampionIds.has(championId)) return;

  ctx.deathPendingIds.delete(championId);
  element.classList.add("dying");
  ctx.dyingChampionIds.add(championId);
  ctx.lastKnownHP.delete(championId);

  setTimeout(() => {
    element.remove();
    ctx.dyingChampionIds.delete(championId);
    ctx.activeChampions.delete(championId);
  }, ctx.durations.CHAMPION_DEATH_ANIMATION_DURATION);
}

function triggerChampionHeal(championId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const element = document.querySelector(`[data-champion-id="${championId}"]`);

  if (!element) return;

  const portrait = element.querySelector(".portrait") || element;

  const float = document.createElement("div");
  float.classList.add("heal-float");
  float.textContent = `+${amount}`;

  portrait.appendChild(float);

  requestAnimationFrame(() => {
    element.classList.add("heal");
  });

  setTimeout(() => {
    float.remove();
    element.classList.remove("heal");
  }, 1850);
}

function triggerChampionShield(championId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const element = document.querySelector(`[data-champion-id="${championId}"]`);

  if (!element) return;

  const portrait = element.querySelector(".portrait") || element;

  const float = document.createElement("div");
  float.classList.add("shield-float");
  float.textContent = `+${amount}`;

  portrait.appendChild(float);

  requestAnimationFrame(() => {
    element.classList.add("shield");
  });

  setTimeout(() => {
    float.remove();
    element.classList.remove("shield");
  }, 1850);
}

function triggerChampionDamage(championId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const element = document.querySelector(`[data-champion-id="${championId}"]`);

  if (!element) return;

  const portrait = element.querySelector(".portrait") || element;
  const tier = getDamageTier(amount);

  const float = document.createElement("div");
  float.classList.add("damage-float", `damage-tier-${tier}`);
  float.textContent = `-${amount}`;

  portrait.appendChild(float);

  requestAnimationFrame(() => {
    element.classList.add("damage");
  });

  setTimeout(() => {
    float.remove();
    element.classList.remove("damage");
  }, 1850);
}

function triggerGameOver(ctx, event) {
  // Prevent multiple triggers
  if (ctx.gameOverTriggered) return;

  ctx.gameOverTriggered = true;
  ctx.shouldStopQueue = true;
  ctx.pendingGameOverEvent = event || null;

  // Set global gameEnded flag and disable actions
  if (window.gameEnded !== undefined) {
    window.gameEnded = true;
  }

  const endTurnBtn = document.querySelector("#end-turn-btn");
  if (endTurnBtn) {
    endTurnBtn.disabled = true;
  }

  // Disable all champion actions
  document.querySelectorAll(".skill-btn").forEach((button) => {
    button.disabled = true;
  });
}

function showFinalGameOver(ctx) {
  if (ctx.gameOverShown) return;

  ctx.gameOverShown = true;

  const event = ctx.pendingGameOverEvent || {};
  const { winnerTeam, winnerName } = event;

  // Get player team from global scope (set in main.js)
  const playerTeam = window.playerTeam || null;
  const isWinner = playerTeam === winnerTeam;

  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverContent = document.getElementById("gameOverContent");
  const gameOverMessage = document.getElementById("gameOverMessage");

  if (!gameOverOverlay || !gameOverContent || !gameOverMessage) {
    console.error("[GameOver] Required DOM elements not found");
    return;
  }

  // Wait a bit after the death animation to show game over
  setTimeout(() => {
    // Show overlay
    gameOverOverlay.classList.remove("hidden");
    gameOverOverlay.classList.add("active");

    // Apply background class
    gameOverOverlay.classList.add(
      isWinner ? "win-background" : "lose-background",
    );
    gameOverOverlay.classList.remove(
      isWinner ? "lose-background" : "win-background",
    );

    // Apply content class
    gameOverContent.classList.add(isWinner ? "win" : "lose");
    gameOverContent.classList.remove(isWinner ? "lose" : "win");
    gameOverContent.classList.remove("hidden");

    // Set message
    gameOverMessage.textContent = isWinner ? "VITÓRIA!" : "DERROTA!";

    // After showing win/lose message, transition to timer overlay
    const GAME_OVER_MESSAGE_DISPLAY_TIME = 10;
    const RETURN_TO_LOGIN_TIME = 120;

    setTimeout(() => {
      // Hide the game over overlay
      gameOverOverlay.classList.remove("active");
      gameOverOverlay.classList.add("hidden");

      // Show the timer overlay
      const timerOverlay = document.getElementById("timerOverlay");
      const returnToLoginCountdown = document.getElementById(
        "returnToLoginCountdown",
      );
      const returnToLoginBtn = document.getElementById("returnToLoginBtn");

      if (!timerOverlay || !returnToLoginCountdown || !returnToLoginBtn) {
        console.error("[GameOver] Timer overlay elements not found");
        return;
      }

      timerOverlay.classList.remove("hidden");
      timerOverlay.classList.add("active");

      // Start countdown
      let finalCountdownTime = RETURN_TO_LOGIN_TIME;
      returnToLoginCountdown.textContent = `Retornando ao login em ${finalCountdownTime} segundos.`;

      const countdownInterval = setInterval(() => {
        finalCountdownTime--;
        returnToLoginCountdown.textContent = `Retornando ao login em ${finalCountdownTime} segundos.`;

        if (finalCountdownTime <= 0) {
          clearInterval(countdownInterval);
          window.location.reload();
        }
      }, 1000);

      // Manual return button
      returnToLoginBtn.onclick = () => {
        clearInterval(countdownInterval);
        window.location.reload();
      };
    }, GAME_OVER_MESSAGE_DISPLAY_TIME * 1000);
  }, ctx.durations.GAME_OVER_DELAY);
}

function getDamageTier(amount) {
  if (amount >= 250) return 6;
  if (amount >= 155) return 5;
  if (amount >= 100) return 4;
  if (amount >= 55) return 3;
  if (amount >= 35) return 2;
  return 1;
}
