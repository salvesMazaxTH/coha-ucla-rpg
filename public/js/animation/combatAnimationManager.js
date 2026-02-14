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
    death: (event) => triggerChampionDeath(ctx, event?.targetId),
  };
}

function normalizeEvents(item) {
  if (Array.isArray(item?.events) && item.events.length > 0) {
    return item.events.filter(Boolean);
  }

  if (item?.event) {
    return [item.event];
  }

  return [];
}

function enqueueCombatItem(ctx, item) {
  ctx.combatQueue.push(item);

  const events = normalizeEvents(item);
  events
    .filter((event) => event?.type === "damage" && event?.targetId)
    .forEach((event) => moveDeathItemToEnd(ctx, event.targetId));

  if (!ctx.combatQueueRunning) {
    processCombatQueue(ctx);
  }
}

function handleChampionRemoved(ctx, championId) {
  ctx.removedChampionIds.add(championId);
  ctx.deathPendingIds.add(championId);
  enqueueCombatItem(ctx, {
    event: { type: "death", targetId: championId },
  });
}

function handleGameStateUpdate(ctx, gameState) {
  if (ctx.combatQueueRunning || ctx.combatQueue.length > 0) {
    ctx.pendingGameState = gameState;
    return;
  }

  applyGameStateUpdate(ctx, gameState);
}

function handleTurnUpdate(ctx, turn) {
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

  hideCombatDialog(ctx);
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

  if (ctx.combatQueue.length === 0) {
    ctx.combatQueueRunning = false;
    hideCombatDialog(ctx);

    if (ctx.pendingGameState) {
      applyGameStateUpdate(ctx, ctx.pendingGameState);
      ctx.pendingGameState = null;
    }

    if (ctx.pendingTurnUpdate !== null) {
      ctx.applyTurnUpdate?.(ctx.pendingTurnUpdate);
      ctx.pendingTurnUpdate = null;
    }

    return;
  }

  ctx.combatQueueRunning = true;

  const item = ctx.combatQueue.shift();

  applyCombatStateSnapshots(ctx, item?.state);

  const events = normalizeEvents(item);
  events.forEach((event) => {
    const handler = ctx.eventHandlers[event?.type];
    if (handler) {
      handler(event);
    }
  });

  if (item?.text) {
    showCombatDialog(ctx, item.text);
  } else {
    hideCombatDialog(ctx);
  }

  let duration = getCombatDialogDuration(ctx, item?.text);

  if (events.some((event) => event?.type === "damage")) {
    duration = Math.max(duration, ctx.durations.DAMAGE_ANIMATION_DURATION);
  }

  if (events.some((event) => event?.type === "heal")) {
    duration = Math.max(duration, ctx.durations.HEAL_ANIMATION_DURATION);
  }

  ctx.combatQueueTimer = setTimeout(() => {
    processCombatQueue(ctx);
  }, duration);
}

function moveDeathItemToEnd(ctx, targetId) {
  const index = ctx.combatQueue.findIndex(
    (entry) =>
      entry?.event?.type === "death" && entry.event.targetId === targetId,
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
  }, 950);
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
  }, 950);
}

function getDamageTier(amount) {
  if (amount >= 250) return 6;
  if (amount >= 155) return 5;
  if (amount >= 100) return 4;
  if (amount >= 55) return 3;
  if (amount >= 35) return 2;
  return 1;
}
