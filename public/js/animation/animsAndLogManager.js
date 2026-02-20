import { formatChampionName } from "/shared/core/formatters.js";
// ============================================================
//  animsAndLogManager.js — Combat Animation & Log System (v2)
//
//  Queue-based, deterministic animation system.
//  Receives structured combat action envelopes from the server
//  and plays effects sequentially with proper visual ordering.
//
//  Architecture:
//    Server emits "combatAction" envelopes with:
//      { action, effects[], log, state[] }
//    This manager queues them and processes one at a time.
//    Each effect is animated before the next begins.
//    Final state is applied only after all effects are animated.
// ============================================================

// ============================================================
//  TIMING CONSTANTS (derived from CSS keyframe durations)
// ============================================================

const TIMING = {
  // Portrait animation class durations (from animations.css)
  DAMAGE_ANIM: 950,
  HEAL_ANIM: 975,
  EVASION_ANIM: 550,
  RESOURCE_ANIM: 850,

  // Float element lifetime (auto-removed after CSS animation)
  FLOAT_LIFETIME: 1900,

  // Death collapse animation
  DEATH_ANIM: 2000,

  // Combat dialog bubble
  DIALOG_DISPLAY: 1500,
  DIALOG_LEAVE: 250,

  // Sequencing gaps
  BETWEEN_EFFECTS: 200,
  BETWEEN_ACTIONS: 350,
};

// ============================================================
//  DAMAGE TIER CLASSIFICATION (maps to CSS .damage-tier-N)
// ============================================================

function getDamageTier(amount) {
  if (amount >= 251) return 6;
  if (amount >= 151) return 5;
  if (amount >= 101) return 4;
  if (amount >= 61) return 3;
  if (amount >= 31) return 2;
  return 1;
}

// ============================================================
//  UTILITY
// ============================================================

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getChampionElement(championId) {
  return document.querySelector(`.champion[data-champion-id="${championId}"]`);
}

// ============================================================
//  FACTORY
// ============================================================

/**
 * Creates the combat animation manager.
 *
 * @param {object} deps
 * @param {Map}      deps.activeChampions
 * @param {Function} deps.createNewChampion
 * @param {Function} deps.getCurrentTurn
 * @param {Function} deps.setCurrentTurn
 * @param {Function} deps.updateTurnDisplay
 * @param {Function} deps.applyTurnUpdate
 * @param {Function} deps.startStatusIndicatorRotation
 * @param {Element}  deps.combatDialog
 * @param {Element}  deps.combatDialogText
 */
export function createCombatAnimationManager(deps) {
  // ============================================================
  //  QUEUE STATE
  // ============================================================

  const queue = [];
  let processing = false;
  let lastLoggedTurn = null;

  // ============================================================
  //  QUEUE MANAGEMENT
  // ============================================================

  function enqueue(type, data) {
    queue.push({ type, data });
    if (!processing) drainQueue();
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
      const item = queue.shift();
      try {
        await dispatchQueueItem(item);
      } catch (err) {
        console.error("[AnimManager] Queue item error:", err);
      }
    }

    processing = false;
  }

  async function dispatchQueueItem(item) {
    switch (item.type) {
      case "combatAction":
        await processCombatAction(item.data);
        await wait(TIMING.BETWEEN_ACTIONS);
        break;

      case "gameStateUpdate":
        processGameStateUpdate(item.data);
        break;

      case "turnUpdate":
        processTurnUpdate(item.data);
        break;

      case "championRemoved":
        await processChampionRemoved(item.data);
        break;

      case "combatLog":
        await processCombatLog(item.data);
        break;

      default:
        console.warn("[AnimManager] Unknown queue type:", item.type);
    }
  }

  async function processCombatLog(text) {
    if (shouldShowLogDialog(text)) {
      const dialogText = stripHtmlTags(text);
      await showDialog(dialogText);
    }

    appendToLog(text);
  }

  function shouldShowLogDialog(text) {
    if (typeof text !== "string") return false;

    const normalized = text.toLowerCase();

    return (
      normalized.includes("aguardando o outro jogador") ||
      normalized.includes("aguardando sua confirmação") ||
      normalized.includes("aguardando por você") ||
      normalized.includes("esperando pelo oponente") ||
      normalized.includes("confirmou o fim do turno") ||
      normalized.includes("marcou um ponto") ||
      normalized.includes("pontuou") ||
      normalized.includes("tentou agir") ||
      normalized.includes("ação pendente")
    );
  }

  function stripHtmlTags(value) {
    if (typeof value !== "string") return "";
    return value.replace(/<[^>]*>/g, "").trim();
  }

  // ============================================================
  //  COMBAT ACTION PROCESSING
  // ============================================================

  async function processCombatAction(envelope) {
    const { action, effects, log, state } = envelope;

    const hasEffects = Array.isArray(effects) && effects.length > 0;

    // 1. Sempre exibe o dialog de uso da skill, independentemente de efeitos
    if (action) {
      const userChampion = deps.activeChampions.get(action.userId);
      const userName = userChampion
        ? formatChampionName(userChampion)
        : action.userName || "Alguém";
      const targetChampion = action.targetId
        ? deps.activeChampions.get(action.targetId)
        : null;
      const targetName = targetChampion
        ? formatChampionName(targetChampion)
        : action.targetName || null;
      const skillName = action.skillName
        ? `<b>${typeof action.skillName === "object" ? action.skillName.name : action.skillName}</b>`
        : "<b>uma habilidade</b>";

      // Se self, não mostra 'em X'
      let dialogText;
      if (targetName && action.userId !== action.targetId) {
        dialogText = `${userName} usou ${skillName} em ${targetName}.`;
      } else {
        dialogText = `${userName} usou ${skillName}.`;
      }

      await showDialog(dialogText, true);
    }

    // 2. Animate each effect sequentially — deterministic order
    if (hasEffects) {
      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];

        await animateEffect(effect);
        if (i < effects.length - 1) {
          await wait(TIMING.BETWEEN_EFFECTS);
        }
      }
    }

    // 3. Apply authoritative final state (corrects any visual discrepancies)
    if (state) {
      applyStateSnapshots(state);
    }

    // 4. Append verbose log text to the combat log panel
    if (log) {
      appendToLog(log);
    }
  }

  // ============================================================
  //  EFFECT ANIMATION DISPATCH
  // ============================================================

  async function animateEffect(effect) {
    if (!effect || !effect.type) return;

    switch (effect.type) {
      case "damage":
        await animateDamage(effect);
        break;

      case "heal":
        await animateHeal(effect);
        break;

      case "evasion":
        await animateEvasion(effect);
        break;

      case "shield":
        await animateShield(effect);
        break;

      case "resourceGain":
        await animateResourceGain(effect);
        break;

      case "resourceSpend":
        await animateResourceSpend(effect);
        break;

      case "gameOver":
        await handleGameOver(effect);
        break;

      case "immune":
        await animateImmune(effect);
        break;

      case "shieldBlock":
        await animateShieldBlock(effect);
        break;

      case "buff":
        await animateBuff(effect);
        break;

      case "tauntRedirection":
        await animateTauntRedirection(effect);
        break;

      default:
        console.warn("[AnimManager] Unknown effect type:", effect.type);
    }
  }

  function shouldShowActionDialog(effect) {
    if (!effect || !effect.type) return false;

    return ["damage", "evasion", "immune", "shieldBlock"].includes(effect.type);
  }

  // ============================================================
  //  DAMAGE ANIMATION
  //
  //  CSS mapping:
  //    .damage           → on .champion (shake + red tint via ::after)
  //    .damage-float     → inside .portrait-wrapper (floating number)
  //    .damage-tier-{N}  → font size tier for the float
  // ============================================================

  async function animateDamage(effect) {
    const { targetId, amount, isCritical, isDot } = effect;
    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");

    if (isDot) {
      const champion = deps.activeChampions.get(targetId);
      const name = champion ? formatChampionName(champion) : "Alvo";
      await showDialog(`${name} sofreu dano.`, true);
    }

    // Show critical hit dialog if applicable
    if (isCritical) {
      const champion = deps.activeChampions.get(targetId);
      const name = champion ? formatChampionName(champion) : "Alvo";
      await showDialog(
        `UM ACERTO CRÍTICO! ${name} sofreu um dano devastador!`,
        true,
      );
    }

    // Apply .damage class to .champion element
    // CSS: .damage triggers shake animation
    // CSS: .damage .portrait::after creates red overlay on portrait
    championEl.classList.add("damage");

    // Create floating damage number inside .portrait-wrapper
    if (portraitWrapper) {
      createFloatElement(
        portraitWrapper,
        `-${amount}`,
        "damage-float",
        `damage-tier-${getDamageTier(amount)}`,
      );
    }

    // Update HP bar incrementally (visual only, not authoritative)
    updateVisualHP(targetId, -amount);

    // Wait for the damage shake animation to complete
    await wait(TIMING.DAMAGE_ANIM);

    // Remove animation class (::after pseudo-element disappears)
    championEl.classList.remove("damage");
  }

  // ============================================================
  //  HEAL ANIMATION
  //
  //  CSS mapping:
  //    .heal        → on .champion (green glow via ::after)
  //    .heal-float  → inside .portrait-wrapper (floating number)
  // ============================================================

  async function animateHeal(effect) {
    const { targetId, amount } = effect;
    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    await showDialog(`${name} recuperou vida.`, true);

    // Apply .heal class to .champion element
    championEl.classList.add("heal");

    // Create floating heal number inside .portrait-wrapper
    if (portraitWrapper) {
      createFloatElement(portraitWrapper, `+${amount}`, "heal-float");
    }

    // Update HP bar incrementally
    updateVisualHP(targetId, amount);

    // Wait for the heal glow animation to complete
    await wait(TIMING.HEAL_ANIM);

    championEl.classList.remove("heal");
  }

  // ============================================================
  //  EVASION ANIMATION
  //
  //  CSS mapping:
  //    .evasion → on .champion (dodge weave + flash via ::after)
  // ============================================================

  async function animateEvasion(effect) {
    const { targetId } = effect;
    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    await showDialog(
      `${name} tentou evadir o ataque... <b>E CONSEGUIU!</b>`,
      true,
    );

    // Apply .evasion class to .champion element
    championEl.classList.add("evasion");

    await wait(TIMING.EVASION_ANIM);

    championEl.classList.remove("evasion");
  }

  // ============================================================
  //  SHIELD ANIMATION
  //
  //  CSS mapping:
  //    .shield-float → inside .portrait-wrapper (floating number)
  //    .has-shield   → applied on .champion via updateUI (bubble effect)
  // ============================================================

  async function animateShield(effect) {
    const { targetId, amount } = effect;
    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    await showDialog(`${name} recebeu um escudo.`, true);

    // Create floating shield number inside .portrait-wrapper
    if (portraitWrapper) {
      createFloatElement(portraitWrapper, `🛡️ ${amount}`, "shield-float");
    }

    // Shield bubble visual (.has-shield) is applied when state syncs via updateUI
    await wait(600);
  }

  // ============================================================
  //  RESOURCE REGEN ANIMATION
  // ============================================================

  async function animateResourceGain(effect) {
    await animateResourceChange(effect, 1);
  }

  async function animateResourceSpend(effect) {
    await animateResourceChange(effect, -1);
  }

  async function animateResourceChange(effect, direction) {
    const { targetId, amount, resourceType } = effect || {};
    const normalizedAmount = Math.abs(Number(amount) || 0);
    if (!targetId || normalizedAmount <= 0) return;

    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const resolvedType = resolveResourceType(
      championEl,
      targetId,
      resourceType,
    );
    const label = resolvedType === "energy" ? "EN" : "MP";
    const sign = direction >= 0 ? "+" : "-";

    if (portraitWrapper) {
      const floatClass =
        direction >= 0
          ? resolvedType === "energy"
            ? "resource-float-energy"
            : "resource-float-mana"
          : "resource-float-spend";

      createFloatElement(
        portraitWrapper,
        `${sign}${normalizedAmount} ${label}`,
        "resource-float",
        floatClass,
      );
    }

    updateVisualResource(
      targetId,
      direction >= 0 ? normalizedAmount : -normalizedAmount,
      resolvedType,
    );

    console.log("START resource anim");

    await wait(TIMING.RESOURCE_ANIM);

    console.log("END resource anim");
  }

  // ============================================================
  //  IMMUNE ANIMATION
  // ============================================================

  async function animateImmune(effect) {
    const { targetId } = effect;
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    await showDialog(`${name} está com <b>Imunidade Absoluta!</b>`, true);
  }

  // ============================================================
  //  SHIELD BLOCK ANIMATION
  // ============================================================

  async function animateShieldBlock(effect) {
    const { targetId } = effect;
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    await showDialog(`O escudo de ${name} bloqueou o ataque!`, true);
  }

  // ============================================================
  //  BUFF ANIMATION
  // ============================================================

  async function animateBuff(effect) {
    const { sourceId, targetId, sourceName, targetName } = effect || {};
    const targetChampion = deps.activeChampions.get(targetId);
    const resolvedTargetName = targetChampion
      ? formatChampionName(targetChampion)
      : targetName || "Alvo";
    const sourceChampion = deps.activeChampions.get(sourceId);
    const resolvedSourceName = sourceChampion
      ? formatChampionName(sourceChampion)
      : sourceName || null;
    const championEl = getChampionElement(targetId);
    const portraitWrapper = championEl?.querySelector(".portrait-wrapper");

    let text = `${resolvedTargetName} foi fortalecido.`;
    if (sourceId && targetId && sourceId === targetId) {
      text = `${resolvedTargetName} fortaleceu-se.`;
    } else if (resolvedSourceName) {
      text = `${resolvedTargetName} foi fortalecido por ${resolvedSourceName}.`;
    }
    await showDialog(text, true);

    if (championEl) {
      championEl.classList.add("buff");
    }

    if (portraitWrapper) {
      createFloatElement(portraitWrapper, "+BUFF", "buff-float");
    }

    await wait(TIMING.HEAL_ANIM);

    if (championEl) {
      championEl.classList.remove("buff");
    }
  }

  // ============================================================
  //  TAUNT ANIMATION
  // ============================================================

  async function animateTauntRedirection(effect) {
    const { attackerId, newTargetId, taunterId } = effect;
    const champion = deps.activeChampions.get(attackerId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    const championEl = getChampionElement(attackerId);
    const portraitWrapper = championEl?.querySelector(".portrait-wrapper");

    // Show taunt dialog
    await showDialog(
      `${name} foi <b>provocado</b> e teve seu alvo redirecionado!`,
      true,
    );

    if (championEl) {
      championEl.classList.add("taunt");
    }
    if (portraitWrapper) {
      createFloatElement(portraitWrapper, "PROVOCAÇÃO", "taunt-float");
    }

    await wait(TIMING.HEAL_ANIM);

    if (championEl) {
      championEl.classList.remove("taunt");
    }
  }
  // ============================================================

  // ============================================================
  //  GAME OVER HANDLING
  // ============================================================

  async function handleGameOver(effect) {
    const { winnerTeam, winnerName } = effect;

    window.gameEnded = true;

    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameOverContent =
      gameOverOverlay?.querySelector(".game-over-content");
    const gameOverMessage = document.getElementById("gameOverMessage");
    const returnToLoginBtn = document.getElementById("returnToLoginBtn");

    if (!gameOverOverlay || !gameOverContent || !gameOverMessage) return;

    const playerTeam = window.playerTeam;
    const isWinner = playerTeam === winnerTeam;

    gameOverMessage.textContent = isWinner
      ? `Vitória! Parabéns, ${winnerName || "Jogador"}!`
      : `Derrota. ${winnerName || "O adversário"} venceu.`;

    gameOverContent.classList.remove("hidden", "win", "lose");
    gameOverContent.classList.add(isWinner ? "win" : "lose");

    gameOverOverlay.classList.remove(
      "hidden",
      "win-background",
      "lose-background",
    );
    gameOverOverlay.classList.add(
      "active",
      isWinner ? "win-background" : "lose-background",
    );

    // Timer for return to login
    const timerOverlay = document.getElementById("timerOverlay");
    const countdownEl = document.getElementById("returnToLoginCountdown");

    if (timerOverlay && countdownEl && returnToLoginBtn) {
      // Show game over screen for 10 seconds, then show countdown timer
      await wait(10000);

      gameOverOverlay.classList.remove("active");
      gameOverOverlay.classList.add("hidden");

      timerOverlay.classList.remove("hidden");
      timerOverlay.classList.add("active");

      let timeLeft = 120;
      countdownEl.textContent = `Retornando ao login em ${timeLeft}s...`;

      const interval = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = `Retornando ao login em ${timeLeft}s...`;
        if (timeLeft <= 0) {
          clearInterval(interval);
          window.location.reload();
        }
      }, 1000);

      returnToLoginBtn.onclick = () => {
        clearInterval(interval);
        window.location.reload();
      };
    }
  }

  // ============================================================
  //  VISUAL HP UPDATE (incremental, before final state sync)
  //
  //  Reads current displayed HP from the DOM, applies a delta,
  //  and updates the HP text + fill bar. This ensures the bar
  //  never jumps to the final value before the animation plays.
  //
  //  The authoritative state is applied AFTER all effects via
  //  applyStateSnapshots() which calls champion.updateUI().
  // ============================================================

  function updateVisualHP(championId, delta) {
    const el = getChampionElement(championId);
    if (!el) return;

    const hpSpan = el.querySelector(".hp");
    const fill = el.querySelector(".hp-fill");
    if (!hpSpan || !fill) return;

    // Parse current displayed HP (format: "current/max" or "current/max 🛡️ (N)")
    const hpText = hpSpan.textContent;
    const match = hpText.match(/^(\d+)\/(\d+)/);
    if (!match) return;

    let currentVisualHP = parseInt(match[1], 10);
    const maxHP = parseInt(match[2], 10);

    // Apply delta and clamp
    currentVisualHP = Math.max(0, Math.min(maxHP, currentVisualHP + delta));

    // Preserve shield info if present
    const shieldMatch = hpText.match(/🛡️\s*\(\d+\)/);
    const shieldSuffix = shieldMatch ? ` ${shieldMatch[0]}` : "";

    hpSpan.textContent = `${currentVisualHP}/${maxHP}${shieldSuffix}`;

    // Update fill bar width and color
    const percent = (currentVisualHP / maxHP) * 100;
    fill.style.width = `${percent}%`;

    if (percent <= 19) {
      fill.style.background = "#ff2a2a";
    } else if (percent <= 49) {
      fill.style.background = "#ffcc00";
    } else {
      fill.style.background = "#00ff66";
    }
  }

  function resolveResourceType(championEl, championId, explicitType) {
    if (explicitType === "energy" || explicitType === "mana") {
      return explicitType;
    }

    const dataType = championEl?.dataset?.resourceType;
    if (dataType === "energy" || dataType === "mana") return dataType;

    const champion = deps.activeChampions.get(championId);
    const fallbackType = champion?.getResourceState?.().type;
    return fallbackType === "energy" ? "energy" : "mana";
  }

  function updateVisualResource(championId, delta, resourceType) {
    const el = getChampionElement(championId);
    if (!el) return;

    const mpSpan = el.querySelector(".mp");
    const fill = el.querySelector(".mp-fill");
    if (!mpSpan || !fill) return;

    const mpText = mpSpan.textContent;
    const match = mpText.match(/^(\d+)\/(\d+)/);
    let current = 0;
    let max = 999;

    if (match) {
      current = parseInt(match[1], 10);
      max = Number.isFinite(parseInt(match[2], 10))
        ? parseInt(match[2], 10)
        : 999;
    } else {
      const single = mpText.match(/^(\d+)/);
      if (!single) return;
      current = parseInt(single[1], 10);
    }

    current = Math.max(0, Math.min(max, current + delta));
    mpSpan.textContent = `${current}`;

    const percent = (current / max) * 100;
    fill.style.width = `${percent}%`;
    fill.style.background = resourceType === "energy" ? "#f4d03f" : "#4aa3ff";

    if (resourceType === "energy" || resourceType === "mana") {
      el.dataset.resourceType = resourceType;
    }
  }

  // ============================================================
  //  FLOAT ELEMENT CREATION
  //
  //  Creates a floating number element (damage/heal/shield)
  //  inside a container (typically .portrait-wrapper).
  //  Auto-removes after the CSS animation completes.
  // ============================================================

  function createFloatElement(container, text, ...cssClasses) {
    const float = document.createElement("span");
    float.classList.add(...cssClasses.filter(Boolean));
    float.textContent = text;
    container.appendChild(float);
    setTimeout(() => {
      if (float.parentNode) float.remove();
    }, TIMING.FLOAT_LIFETIME + 200);
    return float;
  }

  // ============================================================
  //  COMBAT DIALOG (JRPG-style speech bubbles)
  //
  //  Shows a short, non-verbose text in the combat dialog overlay.
  //  Each call waits for the dialog to display and fade out
  //  before returning, ensuring sequential dialog display.
  //
  //  CSS classes used:
  //    .combat-dialog.hidden   → not visible
  //    .combat-dialog.active   → visible (triggers dialogIn)
  //    .combat-dialog.leaving  → fading out (triggers dialogOut)
  // ============================================================

  async function showDialog(text, isHtml = false) {
    const dialog = deps.combatDialog;
    const dialogText = deps.combatDialogText;
    if (!dialog || !dialogText) return;

    // Set text content (HTML or plain)
    if (isHtml) {
      dialogText.innerHTML = text;
    } else {
      dialogText.textContent = text;
    }

    // Show dialog (triggers CSS dialogIn animation on .combat-dialog-bubble)
    dialog.classList.remove("hidden", "leaving");
    dialog.classList.add("active");

    // Display duration
    await wait(TIMING.DIALOG_DISPLAY);

    // Fade out (triggers CSS dialogOut animation)
    dialog.classList.add("leaving");
    await wait(TIMING.DIALOG_LEAVE);

    // Hide completely
    dialog.classList.remove("active", "leaving");
    dialog.classList.add("hidden");
  }

  // ============================================================
  //  STATE SYNCHRONIZATION
  //
  //  Applies authoritative champion state from server snapshots.
  //  Called AFTER all effects are animated for an action,
  //  ensuring the visual state matches the server truth.
  // ============================================================

  function applyStateSnapshots(snapshots) {
    if (!Array.isArray(snapshots)) return;

    for (const snap of snapshots) {
      if (!snap?.id) continue;

      const champion = deps.activeChampions.get(snap.id);
      if (!champion) continue;

      syncChampionFromSnapshot(champion, snap);
      champion.updateUI(deps.getCurrentTurn());
    }
  }

  function syncChampionFromSnapshot(champion, snap) {
    // 🔥 HP só é aplicado se NÃO houve animação de dano
    if (snap.HP !== undefined) {
      champion.HP = snap.HP;
    }

    if (snap.maxHP !== undefined) champion.maxHP = snap.maxHP;
    if (snap.Attack !== undefined) champion.Attack = snap.Attack;
    if (snap.Defense !== undefined) champion.Defense = snap.Defense;
    if (snap.Speed !== undefined) champion.Speed = snap.Speed;
    if (snap.Evasion !== undefined) champion.Evasion = snap.Evasion;
    if (snap.Critical !== undefined) champion.Critical = snap.Critical;
    if (snap.LifeSteal !== undefined) champion.LifeSteal = snap.LifeSteal;

    // Resource
    const hasEnergy = snap.energy !== undefined;
    const hasMana = snap.mana !== undefined;

    if (hasEnergy) {
      champion.energy = snap.energy;
      champion.mana = undefined;
    }

    if (hasMana) {
      champion.mana = snap.mana;
      if (!hasEnergy) champion.energy = undefined;
    }

    // Runtime shields
    if (snap.runtime) {
      champion.runtime = {
        ...champion.runtime,
        shields: Array.isArray(snap.runtime.shields)
          ? snap.runtime.shields
          : [],
      };
    }

    // Keywords
    if (Array.isArray(snap.keywords)) {
      champion.keywords = new Map(snap.keywords);
    }

    // Alive
    if (snap.HP !== undefined) {
      champion.alive = snap.HP > 0;
    }
  }

  // ============================================================
  //  GAME STATE UPDATE (full state sync)
  //
  //  Called after team selection, champion additions, and
  //  at end of each turn. Creates new champions if needed
  //  and syncs all champion data to server truth.
  // ============================================================

  function processGameStateUpdate(gameState) {
    if (!gameState) return;

    const { champions, currentTurn } = gameState;

    if (currentTurn !== undefined) {
      deps.setCurrentTurn(currentTurn);
      deps.updateTurnDisplay(currentTurn);
    }

    if (!Array.isArray(champions)) return;

    for (const champData of champions) {
      if (!champData?.id) continue;

      let champion = deps.activeChampions.get(champData.id);

      if (!champion) {
        // New champion — create and render in the arena
        try {
          champion = deps.createNewChampion(champData);
        } catch (err) {
          console.error("[AnimManager] Failed to create champion:", err);
          continue;
        }
      }

      syncChampionFromSnapshot(champion, champData);
      champion.updateUI(deps.getCurrentTurn());
    }

    // Refresh status indicators for all champions
    deps.startStatusIndicatorRotation([...deps.activeChampions.values()]);
  }

  // ============================================================
  //  TURN UPDATE
  // ============================================================

  function processTurnUpdate(turn) {
    deps.applyTurnUpdate(turn);
  }

  // ============================================================
  //  CHAMPION REMOVED (death animation)
  //
  //  CSS class: .champion.dying → collapse animation (950ms)
  //  Waits for animation, then removes the DOM element.
  // ============================================================

  async function processChampionRemoved(championId) {
    const champion = deps.activeChampions.get(championId);
    if (!champion) return;

    const el = champion.el;
    if (el) {
      // Apply dying class — triggers CSS collapse animation
      el.classList.add("dying");

      // Wait for the death animation to play
      await wait(TIMING.DEATH_ANIM);

      // Remove from DOM
      el.remove();
      champion.el = null;
    }

    deps.activeChampions.delete(championId);
  }

  // ============================================================
  //  COMBAT LOG APPENDING
  //
  //  Manages the text-based combat log panel, including
  //  turn headers for visual separation between turns.
  // ============================================================

  function appendToLog(text) {
    if (!text) return;

    const log = document.getElementById("combat-log");
    if (!log) return;

    const currentTurn = deps.getCurrentTurn();

    // Insert turn header if this is the first log entry for this turn
    if (lastLoggedTurn !== currentTurn) {
      lastLoggedTurn = currentTurn;
      const turnHeader = document.createElement("h2");
      turnHeader.classList.add("turn-header");
      turnHeader.textContent = `Turno ${currentTurn}`;
      log.appendChild(turnHeader);
    }

    // Visual separator between log entries
    if (log.children.length > 1) {
      log.appendChild(document.createElement("br"));
    }

    const line = document.createElement("p");
    line.innerHTML = text.replace(/\n/g, "<br>");
    log.appendChild(line);

    // Auto-scroll to latest entry
    log.scrollTop = log.scrollHeight;
  }

  // ============================================================
  //  RESET
  // ============================================================

  function reset() {
    queue.length = 0;
    processing = false;
    lastLoggedTurn = null;
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================

  return {
    handleCombatAction(envelope) {
      enqueue("combatAction", envelope);
    },
    handleCombatLog(text) {
      enqueue("combatLog", text);
    },
    handleGameStateUpdate(gameState) {
      enqueue("gameStateUpdate", gameState);
    },
    handleTurnUpdate(turn) {
      enqueue("turnUpdate", turn);
    },
    handleChampionRemoved(championId) {
      enqueue("championRemoved", championId);
    },
    appendToLog,
    reset,
  };
}
