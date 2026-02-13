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
  const CHAMPION_DEATH_ANIMATION_DURATION = 2000;
  const DAMAGE_ANIMATION_DURATION = 958;
  const EVASION_ANIMATION_DURATION = 550;
  const HEAL_ANIMATION_DURATION = 900;

  const DIALOG_SPEED = {
    base: 1000,
    perChar: 25,
    max: 4500,
  };

  const dyingChampionIds = new Set();
  const removedChampionIds = new Set();
  const deathPendingIds = new Set();
  const lastKnownHP = new Map();

  const championVisualTimers = new Map();

  const combatQueue = [];
  let combatQueueTimer = null;
  let combatQueueRunning = false;
  let pendingGameState = null;
  let pendingTurnUpdate = null;

  const enqueueCombatItem = (item) => {
    combatQueue.push(item);

    if (item?.event?.type === "damage" && item.event.targetId) {
      moveDeathItemToEnd(item.event.targetId);
    }

    if (!combatQueueRunning) {
      processCombatQueue();
    }
  };

  const handleChampionRemoved = (championId) => {
    removedChampionIds.add(championId);
    deathPendingIds.add(championId);
    enqueueCombatItem({
      event: { type: "death", targetId: championId },
    });
  };

  const handleGameStateUpdate = (gameState) => {
    if (combatQueueRunning || combatQueue.length > 0) {
      pendingGameState = gameState;
      return;
    }

    applyGameStateUpdate(gameState);
  };

  const handleTurnUpdate = (turn) => {
    if (combatQueueRunning || combatQueue.length > 0) {
      pendingTurnUpdate = turn;
      return;
    }

    applyTurnUpdate?.(turn);
  };

  const reset = () => {
    combatQueue.length = 0;
    combatQueueRunning = false;
    pendingGameState = null;
    pendingTurnUpdate = null;

    if (combatQueueTimer) {
      clearTimeout(combatQueueTimer);
      combatQueueTimer = null;
    }

    for (const timer of championVisualTimers.values()) {
      clearTimeout(timer);
    }
    championVisualTimers.clear();

    dyingChampionIds.clear();
    removedChampionIds.clear();
    deathPendingIds.clear();
    lastKnownHP.clear();

    hideCombatDialog();
  };

  const applyGameStateUpdate = (gameState) => {
    if (!gameState) return;

    setCurrentTurn?.(gameState.currentTurn);
    updateTurnDisplay?.(gameState.currentTurn);

    const existingChampionElements = new Map();
    document.querySelectorAll(".champion").forEach((el) => {
      existingChampionElements.set(el.dataset.championId, el);
    });

    gameState.champions.forEach((championData) => {
      if (dyingChampionIds.has(championData.id)) {
        return;
      }

      const isRemoved = removedChampionIds.has(championData.id);
      const isDeathPending = deathPendingIds.has(championData.id);

      if (isRemoved && !isDeathPending) {
        return;
      }

      let champion = activeChampions.get(championData.id);
      if (champion) {
        if (!champion.el) {
          if (isRemoved) {
            return;
          }

          activeChampions.delete(championData.id);
          champion = createNewChampion(championData);
        }

        syncChampionFromData(champion, championData);
        existingChampionElements.delete(championData.id);
      } else {
        if (isRemoved) {
          return;
        }

        const newChampion = createNewChampion(championData);
        syncChampionFromData(newChampion, championData);
      }
    });

    existingChampionElements.forEach((el, id) => {
      if (!dyingChampionIds.has(id) && !deathPendingIds.has(id)) {
        el.remove();
        activeChampions.delete(id);
        lastKnownHP.delete(id);
      }
    });

    startStatusIndicatorRotation?.(Array.from(activeChampions.values()));
  };

  const syncChampionFromData = (champion, championData) => {
    const currentTurn = getCurrentTurn?.() ?? 1;
    const prevHp = lastKnownHP.get(championData.id);

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

    const isInitial = !Number.isFinite(prevHp);
    const delta = championData.HP - (Number.isFinite(prevHp) ? prevHp : 0);

    if (!isInitial && delta > 0) {
      triggerChampionHeal(championData.id, delta);
    }

    lastKnownHP.set(championData.id, championData.HP);
  };

  const applyCombatStateSnapshots = (stateList) => {
    if (!Array.isArray(stateList) || stateList.length === 0) return;

    stateList.forEach((championData) => {
      if (dyingChampionIds.has(championData.id)) {
        return;
      }

      const isRemoved = removedChampionIds.has(championData.id);
      const isDeathPending = deathPendingIds.has(championData.id);

      if (isRemoved && !isDeathPending) {
        return;
      }

      let champion = activeChampions.get(championData.id);

      if (!champion) {
        if (isRemoved) {
          return;
        }

        champion = createNewChampion(championData);
      } else if (!champion.el) {
        if (isRemoved) {
          return;
        }

        activeChampions.delete(championData.id);
        champion = createNewChampion(championData);
      }

      syncChampionFromData(champion, championData);
    });

    startStatusIndicatorRotation?.(Array.from(activeChampions.values()));
  };

  const processCombatQueue = () => {
    if (combatQueueTimer) {
      clearTimeout(combatQueueTimer);
      combatQueueTimer = null;
    }

    if (combatQueue.length === 0) {
      combatQueueRunning = false;
      hideCombatDialog();

      if (pendingGameState) {
        applyGameStateUpdate(pendingGameState);
        pendingGameState = null;
      }

      if (pendingTurnUpdate !== null) {
        applyTurnUpdate?.(pendingTurnUpdate);
        pendingTurnUpdate = null;
      }

      return;
    }

    combatQueueRunning = true;

    const item = combatQueue.shift();

    applyCombatStateSnapshots(item?.state);

    if (item?.event?.type === "evasion") {
      triggerChampionVisual(
        item.event.targetId,
        "evasion",
        EVASION_ANIMATION_DURATION,
      );
    }

    if (item?.event?.type === "damage") {
      triggerChampionVisual(
        item.event.targetId,
        "damage",
        DAMAGE_ANIMATION_DURATION,
      );
    }

    if (item?.event?.type === "death") {
      triggerChampionDeath(item.event.targetId);
    }

    if (item?.text) {
      showCombatDialog(item.text);
    } else {
      hideCombatDialog();
    }

    let duration = getCombatDialogDuration(item?.text);

    if (item?.event?.type === "damage") {
      duration = Math.max(duration, DAMAGE_ANIMATION_DURATION);
    }

    combatQueueTimer = setTimeout(() => {
      processCombatQueue();
    }, duration);
  };

  const moveDeathItemToEnd = (targetId) => {
    const index = combatQueue.findIndex(
      (entry) =>
        entry?.event?.type === "death" && entry.event.targetId === targetId,
    );

    if (index === -1) return;

    const [deathItem] = combatQueue.splice(index, 1);
    combatQueue.push(deathItem);
  };

  const getCombatDialogDuration = (text) => {
    if (!text) return 450;

    const length = stripHtml(text).trim().length;
    //const base = 1000;
    //const perChar = 25;
    //const max = 4500;

    return Math.min(
      DIALOG_SPEED.max,
      DIALOG_SPEED.base + length * DIALOG_SPEED.perChar,
    );
  };

  const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, "");

  const showCombatDialog = (text) => {
    if (!combatDialog || !combatDialogText) return;

    combatDialogText.innerHTML = String(text).replace(/\n/g, "<br>");
    combatDialog.classList.remove("hidden", "leaving");
    combatDialog.classList.add("active");
  };

  const hideCombatDialog = () => {
    if (!combatDialog) return;

    if (!combatDialog.classList.contains("active")) {
      combatDialog.classList.add("hidden");
      combatDialog.classList.remove("leaving");
      return;
    }

    combatDialog.classList.remove("active");
    combatDialog.classList.add("leaving");

    setTimeout(() => {
      combatDialog.classList.add("hidden");
      combatDialog.classList.remove("leaving");
    }, 200);
  };

  const triggerChampionVisual = (championId, className, durationMs) => {
    const champion = activeChampions.get(championId);
    const element =
      champion?.el ||
      document.querySelector(`[data-champion-id="${championId}"]`);

    if (!element) return;

    const timerKey = `${championId}:${className}`;
    const existingTimer = championVisualTimers.get(timerKey);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);

    if (Number.isFinite(durationMs) && durationMs > 0) {
      const timer = setTimeout(() => {
        element.classList.remove(className);
        championVisualTimers.delete(timerKey);
      }, durationMs);

      championVisualTimers.set(timerKey, timer);
    }
  };

  const triggerChampionDeath = (championId) => {
    const champion = activeChampions.get(championId);
    const element =
      champion?.el ||
      document.querySelector(`[data-champion-id="${championId}"]`);

    if (!element) return;

    if (dyingChampionIds.has(championId)) return;

    deathPendingIds.delete(championId);
    element.classList.add("dying");
    dyingChampionIds.add(championId);
    lastKnownHP.delete(championId);

    setTimeout(() => {
      element.remove();
      dyingChampionIds.delete(championId);
      activeChampions.delete(championId);
    }, CHAMPION_DEATH_ANIMATION_DURATION);
  };

  return {
    applyGameStateUpdate,
    enqueueCombatItem,
    handleChampionRemoved,
    handleGameStateUpdate,
    handleTurnUpdate,
    reset,
  };
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
