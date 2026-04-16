import { formatChampionName } from "../../../shared/ui/formatters.js";

import { syncChampionVFX } from "../../../shared/vfx/vfxManager.js";
import { playFinishingEffect } from "../../../shared/vfx/finishing.js";
import { playLifestealTransferVFX } from "../../../shared/vfx/lifestealTransferCanvas.js";
import { StatusIndicator } from "../../../shared/ui/statusIndicator.js";
import { playDeathClaimEffect } from "../../../shared/vfx/deathClaim.js";
import { audioManager } from "../utils/AudioManager.js";
import { animateSkill } from "./skillAnimations.js";

// ============================================================
//  AnimsAndLogManager.js — Combat Animation & Log System (v2)
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
  // Float element lifetime (auto-removed after CSS animation)
  FLOAT_LIFETIME: 1900,

  // Death collapse animation
  DEATH_ANIM: 2000,

  // Combat dialog bubble
  DIALOG_DISPLAY: 2350, // Reduced from 1200
  DIALOG_LEAVE: 160, // Reduced from 180

  // Sequencing gaps
  BETWEEN_EFFECTS: 60, // Reduced from 120
  BETWEEN_ACTIONS: 60, // Reduced from 60

  DEATH_CLAIM_EFFECT: 5600,
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

function parseVisualHpState(hpText) {
  if (typeof hpText !== "string") return null;

  const hpMatch = hpText.match(/^(\d+)\/(\d+)/);
  if (!hpMatch) return null;

  const shieldMatch = hpText.match(/🛡️\s*\((\d+)\)/);

  return {
    currentHP: parseInt(hpMatch[1], 10),
    maxHP: parseInt(hpMatch[2], 10),
    shield: shieldMatch ? parseInt(shieldMatch[1], 10) : 0,
  };
}

function getChampionElement(championId) {
  return document.querySelector(`.champion[data-champion-id="${championId}"]`);
}

function scrollIfNeeded(
  el,
  {
    threshold = 0.6, // quanto do elemento precisa estar visível (0 a 1)
    behavior = "smooth",
  } = {},
) {
  const rect = el.getBoundingClientRect();

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  const visibleTop = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.bottom, viewportHeight);

  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const elementHeight = rect.height || 1;

  const visibilityRatio =
    visibleHeight / Math.min(elementHeight, viewportHeight);

  if (visibilityRatio < threshold) {
    if (rect.top < 0) {
      el.scrollIntoView({ behavior, block: "start" });
    } else if (rect.bottom > viewportHeight) {
      el.scrollIntoView({ behavior, block: "end" });
    }
  }
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
 * @param {Function} deps.syncStatusIndicatorRotation
 * @param {Element}  deps.combatDialog
 * @param {Element}  deps.combatDialogText
 */
export function createCombatAnimationManager(deps) {
  // ============================================================
  //  QUEUE STATE
  // ============================================================

  const queue = [];
  const { onQueueEmpty } = deps;
  let processing = false;
  let lastLoggedTurn = null;
  let currentPhase = null;
  let activeDialogController = null;
  const editMode = deps.editMode || { freeCostSkills: false };

  // Double-click em qualquer área da tela acelera apenas o dialog atual.
  document.addEventListener("click", () => {
    if (activeDialogController) {
      activeDialogController.requestSkip();
    }
  });

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

    if (typeof onQueueEmpty === "function" && currentPhase === "combat") {
      currentPhase = null;
      onQueueEmpty();
    }
  }

  async function dispatchQueueItem(item) {
    console.log("📦 DISPATCH:", item.type);

    switch (item.type) {
      case "combatAction":
        console.log("⚔️ START combatAction");
        await processCombatAction(item.data);
        console.log("✅ END combatAction");
        await wait(TIMING.BETWEEN_ACTIONS);
        break;

      case "gameStateUpdate":
        console.log("🧠 APPLY gameStateUpdate");
        processGameStateUpdate(item.data);
        break;

      case "turnUpdate":
        processTurnUpdate(item.data);
        break;

      case "championRemoved":
        await processChampionRemoved(item.data);
        break;

      // case "championSwitchedOut":
      //   await processChampionSwitchedOut(item.data);
      //   break;

      case "combatLog":
        await processCombatLog(item.data);
        break;

      case "combatPhaseComplete":
        currentPhase = "combat";
        break;

      case "gameOver":
        await handleGameOver(item.data);
        break;

      default:
        console.log("❓ OTHER:", item.type);
        console.warn("[AnimManager] Unknown queue type:", item.type);
    }
  }

  async function processCombatLog(text) {
    console.log("[DEBUG] processCombatLog called with:", text);
    if (shouldShowLogDialog(text)) {
      const dialogText = stripHtmlTags(text);
      // showNonBlockingDialog removido
      console.log(
        `[AnimManager] dialogText:`,
        dialogText,
        "não fazer nada, trecho legado para possível futura reativação",
      );
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

  function createEventDispatcher() {
    const handlers = {
      damageEvents: { handler: animateDamage },
      healEvents: { handler: animateHeal },
      lifestealEvents: { handler: animateLifesteal },
      shieldEvents: { handler: animateShield },
      buffEvents: { handler: animateBuff, single: true },
      resourceEvents: { handler: animateResourceChange },
      redirectionEvents: { handler: animateTauntRedirection },
    };

    const keys = Object.keys(handlers);

    async function runEvent(event, handler) {
      if (event.preDialogs?.length) {
        await runDialogs(event.preDialogs);
      }
      await Promise.resolve(handler(event));
      if (event.postDialogs?.length) {
        await runDialogs(event.postDialogs);
      }
    }

    async function runGroup(key, events) {
      if (!Array.isArray(events) || events.length === 0) return;

      const config = handlers[key];

      if (!config) {
        console.warn("Evento desconhecido:", key);
        return;
      }

      const { handler, single } = config;

      if (single) {
        const event = events[0];
        if (event) {
          await runEvent(event, handler);
        }
        return;
      }

      for (const event of events) {
        if (!event) continue;
        await runEvent(event, handler);
      }
    }

    return {
      keys,
      runGroup,
    };
  }

  async function processCombatAction(envelope) {
    const dispatcher = createEventDispatcher();
    const { action, log, state } = envelope;

    // action dialog
    if (action && typeof handleActionDialog === "function") {
      currentPhase = "combat";
      await handleActionDialog(action);
    }

    // (Skill animation now handled per DamageEvent in animateDamage)

    /* console.log("[DEBUG] [JEFF REVIVAL DIALOG] CLIENT RECEIVED ENVELOPE:", envelope); */

    // GLOBAL dialogs (SEMPRE executa)
    if (envelope.globalDialogs?.length) {
      await runDialogs(envelope.globalDialogs);
    }
    const hasAnyEvent = dispatcher.keys.some((key) => envelope[key]?.length);

    if (!hasAnyEvent) {
      if (state) applyStateSnapshots(state);
      if (log) appendToLog(log);
      return;
    }

    // event loop
    for (const key of dispatcher.keys) {
      await dispatcher.runGroup(key, envelope[key]);
    }

    if (state) applyStateSnapshots(state);
    if (log) appendToLog(log);
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
    const {
      targetId,
      userId,
      sourceId,
      amount,
      rawAmount,
      absorbedByShield,
      remainingShield,
      isCritical,
      isDot,
      obliterate,
      finishing,
      finishingType,
      skillKey,
    } = effect;

    const casterId = userId || sourceId || null;

    const champion = deps.activeChampions.get(targetId);
    const championEl = getChampionElement(targetId);
    const userEl = casterId ? getChampionElement(casterId) : null;
    const userChampion = casterId ? deps.activeChampions.get(casterId) : null;
    const skill = userChampion?.skills?.find((s) => s?.key === skillKey);

    if (!championEl) return Promise.resolve();

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const actualPortrait = portraitWrapper?.querySelector(".portrait");

    if (actualPortrait) {
      scrollIfNeeded(actualPortrait, { threshold: 0.85 });
    }

    // 🔥 Skill animation (if registered) — now per DamageEvent
    if (skillKey) {
      await animateSkill(skillKey, { targetEl: championEl, userEl, skill });
    }

    // ========================
    // INTERRUPÇÕES
    // ========================

    if (effect.evaded !== undefined) {
      await animateEvasion(effect);
      if (effect.evaded) return;
    }

    const resolvedFinishingType =
      finishingType ||
      (obliterate ? "obliterate" : finishing ? "generic" : null);
    const isFinishing = !!resolvedFinishingType;
    const isObliterate = resolvedFinishingType === "obliterate";

    if (effect.immune) return await animateImmune(effect);
    if (effect.shieldBlocked) return await animateShieldBlock(effect);
    if (!isFinishing && (!amount || amount <= 0)) return;

    const targetName = champion ? formatChampionName(champion) : "Alvo";

    // ========================
    // PRÉ-DANO (DOT)
    // ========================

    if (isDot) {
      await showDialog(`${targetName} sofreu dano.`);
    }

    // ========================
    // FEEDBACK VISUAL IMEDIATO
    // ========================

    championEl.classList.add("damage");
    audioManager.play("damage");

    if (portraitWrapper) {
      const hpDamage = Math.max(0, Number(amount) || 0);
      const hasShieldAbsorption = (Number(absorbedByShield) || 0) > 0;
      const floatValue =
        isObliterate || isFinishing
          ? "999"
          : hpDamage > 0
            ? `-${hpDamage}`
            : hasShieldAbsorption
              ? "🛡️"
              : "0";
      const extraClass = isObliterate
        ? "obliterate"
        : isFinishing
          ? "finishing"
          : `damage-tier-${getDamageTier(Math.max(1, hpDamage))}`;

      createFloatElement(
        portraitWrapper,
        floatValue,
        "damage-float",
        extraClass,
      );
    }

    // ========================
    // EXECUÇÃO PRINCIPAL
    // ========================

    if (isFinishing) {
      updateVisualHP(targetId, -champion.currentHp, 0);

      await playFinishingEffect(championEl, {
        variant: resolvedFinishingType || undefined,
      });

      championEl.dataset.finishing = "true";
      if (isObliterate) {
        championEl.dataset.obliterated = "true";
      }

      return; // já aguardou tudo
    }

    // dano normal
    const hpDamage = Math.max(0, Number(amount) || 0);

    const hpText = championEl.querySelector(".hp")?.textContent || "";
    const visualState = parseVisualHpState(hpText);
    const rawHit = Math.max(0, Number(rawAmount));
    const absorbedFromEvent = Math.max(0, Number(absorbedByShield));
    const fallbackAbsorbed = visualState
      ? Math.min(visualState.shield, Math.max(0, rawHit - hpDamage))
      : 0;
    const absorbed = absorbedFromEvent || fallbackAbsorbed;

    updateVisualHP(targetId, -hpDamage, null, {
      shieldDelta: absorbed > 0 ? -absorbed : 0,
      shieldOverride: Number.isFinite(remainingShield)
        ? Math.max(0, Number(remainingShield))
        : null,
    });

    // ========================
    // CRÍTICO (dialog interno)
    // ========================

    if (isCritical) {
      await showDialog(
        `UM ACERTO CRÍTICO! ${targetName} sofreu um dano devastador!`,
      );
    }

    // ========================
    // ESPERA REAL DA ANIMAÇÃO
    // ========================

    await waitForAnimation(championEl, 600);

    // ⚠️ esse delay é importante pro pacing visual
    await wait(450);

    championEl.classList.remove("damage");
  }

  /** * Helper única para limpar o boilerplate de eventos de animação
   */
  function waitForAnimation(el, timeout) {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.target === el) cleanup();
      };
      const timer = setTimeout(cleanup, timeout);
      function cleanup() {
        el.removeEventListener("animationend", handler);
        clearTimeout(timer);
        resolve();
      }
      el.addEventListener("animationend", handler);
    });
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
    const actualPortrait = portraitWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    const champion = deps.activeChampions.get(targetId);

    const targetName = champion ? formatChampionName(champion) : "Alvo";

    await showDialog(`${targetName} recuperou vida.`);

    // Play healing SFX
    audioManager.play("heal");

    // Apply .heal class to .champion element
    championEl.classList.add("heal");

    // Create floating heal number inside .portrait-wrapper
    if (portraitWrapper) {
      createFloatElement(portraitWrapper, `+${amount}`, "heal-float");
    }

    // Update HP bar incrementally
    updateVisualHP(targetId, amount);

    // 🔥 Espera a animação CSS terminar de verdade
    await waitForAnimation(championEl, 600);

    championEl.classList.remove("heal");
  }

  async function animateLifesteal(effect) {
    const { targetId, amount, fromTargetId } = effect;

    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const actualPortrait = portraitWrapper?.querySelector(".portrait");
    if (actualPortrait) {
      scrollIfNeeded(actualPortrait, { threshold: 0.85 });
    }

    const champion = deps.activeChampions.get(targetId);
    const targetName = champion ? formatChampionName(champion) : "Alvo";
    const drainedEl = fromTargetId ? getChampionElement(fromTargetId) : null;

    await showDialog(`${targetName} drenou vida do alvo.`);

    // Reutiliza o SFX de cura com assinatura visual própria para lifesteal.
    audioManager.play("heal");

    if (drainedEl) {
      drainedEl.classList.add("lifesteal-drained");
    }

    championEl.classList.add("lifesteal");

    await playLifestealTransferVFX({
      fromEl: drainedEl,
      toEl: championEl,
      duration: 780,
    });

    if (portraitWrapper) {
      createFloatElement(
        portraitWrapper,
        `+${amount}`,
        "heal-float",
        "lifesteal-float",
      );
    }

    updateVisualHP(targetId, amount);

    await waitForAnimation(championEl, 760);

    championEl.classList.remove("lifesteal");

    if (drainedEl) {
      drainedEl.classList.remove("lifesteal-drained");
    }
  }

  // ============================================================
  //  EVASION ANIMATION
  //
  //  CSS mapping:
  //    .evasion → on .champion (dodge weave + flash via ::after)
  // ============================================================

  async function animateEvasion(effect) {
    const { targetId, evaded } = effect;
    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const actualPortrait = portraitWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";

    await showDialog(`${name} tentou esquivar o ataque...`);

    if (evaded) {
      // 🔥 INICIA A ANIMAÇÃO
      championEl.classList.add("evasion");

      // 🔥 Espera a animação CSS terminar de verdade
      await waitForAnimation(championEl, 600);

      championEl.classList.remove("evasion");
      await showDialog(`${name} CONSEGUIU esquivar o ataque!!`);
      // meme/trollagem
      /* await showDialog(`e conseguiu!`);
      const randomTrollMessage = Math.random();
      if (randomTrollMessage < 0.5) {
        await showDialog(`e conseguiu!!`);
        await showDialog(`e conseguiu!!! 🤗`);
        await showDialog(`e conseguiu!!! 🥳`);
      } else {
        await showDialog(`...mas foi tão ruim que tropeçou e caiu no chão.`);
      } */
    } else {
      await showDialog(`...mas falhou em esquivar.`);
    }
  }

  //  ============================================================
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
    const actualPortrait = portraitWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    const champion = deps.activeChampions.get(targetId);

    const name = champion ? formatChampionName(champion) : "Alvo";

    await showDialog(`${name} recebeu um escudo.`);

    // Create floating shield number inside .portrait-wrapper
    if (portraitWrapper) {
      createFloatElement(portraitWrapper, `🛡️ ${amount}`, "shield-float");
    }

    updateVisualHP(targetId, 0, null, {
      shieldDelta: Number(amount) || 0,
    });

    // Shield bubble visual (.has-shield) is applied when state syncs via updateUI
    await wait(600);
  }

  // ============================================================
  //  RESOURCE REGEN ANIMATION
  // ============================================================

  function animateResourceChange(effect, direction = 1) {
    const { targetId, amount } = effect || {};
    const normalizedAmount = Math.abs(Number(amount) || 0);

    if (!targetId || normalizedAmount <= 0) return;

    const championEl = getChampionElement(targetId);
    if (!championEl) return;

    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const actualPortrait = portraitWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    const sign = direction >= 0 ? "+" : "-";
    const bars = getUltBarDelta(
      direction >= 0 ? normalizedAmount : -normalizedAmount,
    );

    if (portraitWrapper) {
      const floatClass =
        direction >= 0 ? "resource-float-ult-gain" : "resource-float-ult-spend";

      createFloatElement(
        portraitWrapper,
        `${sign}${bars}`,
        "resource-float",
        floatClass,
      );
    }

    updateVisualResource(
      targetId,
      direction >= 0 ? normalizedAmount : -normalizedAmount,
      "ult",
    );
  }

  function getUltBarDelta(deltaUnits) {
    const UNITS_PER_BAR = 4; // Deve ser consistente com Champion.js
    return (deltaUnits / UNITS_PER_BAR).toFixed(2);
  }

  // ============================================================
  //  IMMUNE ANIMATION
  // ============================================================

  async function animateImmune(effect) {
    const { targetId, immuneMessage } = effect;
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    const message = immuneMessage || `${name} está <b>Imune!</b>`;
    await showDialog(message);
  }

  // ============================================================
  //  SHIELD BLOCK ANIMATION
  // ============================================================

  async function animateShieldBlock(effect) {
    const { targetId } = effect;
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";

    await showDialog(`O escudo de ${name} bloqueou o ataque!`);
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

    if (!championEl) return;

    // Garante que o alvo esteja visível antes de iniciar a animação
    const portraiWrapper = championEl.querySelector(".portrait-wrapper");
    const actualPortrait = portraiWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    const portraitWrapper = championEl?.querySelector(".portrait-wrapper");

    // Universal: se não há sourceId, ou sourceId === targetId, é auto-buff
    let text;

    if (!sourceId || sourceId === targetId) {
      text = `${resolvedTargetName} fortaleceu-se.`;
    } else if (resolvedSourceName) {
      text = `${resolvedTargetName} foi fortalecido por ${resolvedSourceName}.`;
    } else {
      text = `${resolvedTargetName} foi fortalecido.`;
    }

    await showDialog(text);

    if (championEl) {
      championEl.classList.add("buff");
    }

    if (portraitWrapper) {
      createFloatElement(portraitWrapper, "+BUFF", "buff-float");
    }

    // 🔥 Espera a animação CSS terminar de verdade
    await waitForAnimation(championEl, 600);

    championEl.classList.remove("buff");
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
    );

    if (championEl) {
      championEl.classList.add("taunt");
    }
    if (portraitWrapper) {
      createFloatElement(portraitWrapper, "PROVOCADO", "taunt-float");
    }

    await waitForAnimation(championEl, 400);
    championEl.classList.remove("taunt");

    // Descomentar quando criar a animação de provocação no CSS e quiser que o efeito dure o tempo da animação
    // 🔥 Espera a animação CSS terminar de verdade
    /* await new Promise((resolve) => {
      const handler = (event) => {
        if (event.target === championEl) {
          championEl.removeEventListener("animationend", handler);
          resolve();
        }
      };

      championEl?.addEventListener("animationend", handler);
    });

    championEl?.classList.remove("taunt"); */
  }
  // ============================================================

  // ============================================================
  //  GAME OVER HANDLING
  // ============================================================

  async function handleGameOver(effect) {
    console.log("Game over effect received:", effect);
    const { winnerTeam } = effect;

    window.gameEnded = true;

    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameOverContent =
      gameOverOverlay?.querySelector(".game-over-content");
    const gameOverMessage = document.getElementById("gameOverMessage");
    const returnToLoginBtn = document.getElementById("returnToLoginBtn");

    if (!gameOverOverlay || !gameOverContent || !gameOverMessage) return;

    const playerTeam = window.playerTeam;
    const isWinner = playerTeam === winnerTeam;

    gameOverMessage.textContent = isWinner ? `Vitória!!` : `Derrota`;

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

    // Play appropriate sound
    audioManager.play(isWinner ? "victory" : "defeat");

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

  function updateVisualHP(
    championId,
    delta,
    currentVisualHP = null,
    options = {},
  ) {
    delta = Number(delta) || 0;
    const shieldDelta = Number(options?.shieldDelta) || 0;
    const shieldOverride = Number.isFinite(options?.shieldOverride)
      ? Math.max(0, Number(options.shieldOverride))
      : null;

    console.log(
      `Updating visual HP for champion ${championId}: delta=${delta}, currentVisualHP=${currentVisualHP}`,
    );

    const el = getChampionElement(championId);
    if (!el) return;

    const hpSpan = el.querySelector(".hp");
    const fill = el.querySelector(".hp-fill");
    if (!hpSpan || !fill) return;

    // Parse current displayed HP (format: "current/max" or "current/max 🛡️ (N)")
    const hpText = hpSpan.textContent;
    const visualState = parseVisualHpState(hpText);
    if (!visualState) return;

    currentVisualHP =
      currentVisualHP !== null ? currentVisualHP : visualState.currentHP;

    const maxHP = visualState.maxHP;
    const currentShield = visualState.shield;

    // Apply delta and clamp
    currentVisualHP = Math.max(0, Math.min(maxHP, currentVisualHP + delta));
    const nextShield =
      shieldOverride !== null
        ? shieldOverride
        : Math.max(0, currentShield + shieldDelta);

    const shieldSuffix = nextShield > 0 ? ` 🛡️ (${nextShield})` : "";

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

  function updateVisualResource(championId, deltaUnits) {
    const el = getChampionElement(championId);
    if (!el) return;

    const fill = el.querySelector(".ult-fill");
    if (!fill) return;

    // 🔹 Cap fixo do sistema
    const MAX_UNITS = 24;
    const UNITS_PER_BAR = 4;

    // 🔹 Pega valor atual do dataset (fonte confiável da UI)
    let currentUnits = Number(el.dataset.ultUnits || 0);

    // 🔹 Aplica delta
    currentUnits = Math.max(0, Math.min(MAX_UNITS, currentUnits + deltaUnits));

    // 🔹 Salva novamente
    el.dataset.ultUnits = currentUnits;

    // 🔹 Atualiza barra visual contínua
    const percent = (currentUnits / MAX_UNITS) * 100;
    fill.style.width = `${percent}%`;
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

  async function handleActionDialog(action) {
    if (!action) return;

    const { userId, userName, skillName, targetId, targetName } = action;

    const userChampion = deps.activeChampions.get(userId);

    const resolvedUserName = userChampion
      ? formatChampionName(userChampion)
      : userName || "Alguém";

    const resolvedSkillName = skillName
      ? `<b>${typeof skillName === "object" ? skillName.name : skillName}</b>`
      : "<b>uma habilidade</b>";

    // 🔹 CONFIA 100% NO SERVER
    const hasValidTarget = targetId && targetId !== userId && targetName;

    const dialogText = hasValidTarget
      ? `${resolvedUserName} usou ${resolvedSkillName} em ${targetName}.`
      : `${resolvedUserName} usou ${resolvedSkillName}.`;

    await showDialog(dialogText);
  }

  function createDialogController() {
    let skipRequested = false;
    let releaseCurrentWait = null;

    function resolveCurrentWaitNow() {
      if (typeof releaseCurrentWait === "function") {
        releaseCurrentWait();
      }
    }

    return {
      async waitWithOptionalSkip(ms) {
        if (skipRequested) {
          await wait(20);
          return;
        }

        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            releaseCurrentWait = null;
            resolve();
          }, ms);

          releaseCurrentWait = () => {
            clearTimeout(timer);
            releaseCurrentWait = null;
            resolve();
          };
        });
      },
      requestSkip() {
        skipRequested = true;
        resolveCurrentWaitNow();
      },
      dispose() {
        releaseCurrentWait = null;
      },
    };
  }

  /**
   * Unified dialog display. If duration is provided, dialog auto-closes after duration ms. If omitted, dialog is blocking and always waits for user or skip (never auto-advances).
   * @param {string} text
   * @param {number} [duration] - Optional duration in ms. If omitted, dialog is blocking (user/skip only).
   */
  async function showDialog(text, duration) {
    const dialog = deps.combatDialog;
    const dialogText = deps.combatDialogText;
    if (!dialog || !dialogText) return;

    if (duration) {
      // Non-blocking dialog: auto-close after duration, but allow skip
      const dialogController = createDialogController();
      activeDialogController = dialogController;
      dialogText.innerHTML = text;
      dialog.classList.remove("hidden", "leaving");
      dialog.classList.add("active");
      await wait(20); // allow DOM update
      // Wait for either duration or skip
      let finished = false;
      const timer = wait(duration).then(() => {
        finished = true;
        dialogController.requestSkip();
      });
      await dialogController.waitWithOptionalSkip(duration + 100); // allow skip at any time
      dialog.classList.add("leaving");
      await wait(TIMING.DIALOG_LEAVE);
      dialog.classList.remove("active", "leaving");
      dialog.classList.add("hidden");
      if (activeDialogController === dialogController) {
        activeDialogController = null;
      }
      dialogController.dispose();
      return;
    }

    // Blocking dialog: waits for skip/user
    const dialogController = createDialogController();
    activeDialogController = dialogController;
    dialogText.innerHTML = text;
    dialog.classList.remove("hidden", "leaving");
    dialog.classList.add("active");
    await dialogController.waitWithOptionalSkip(TIMING.DIALOG_DISPLAY);
    dialog.classList.add("leaving");
    await dialogController.waitWithOptionalSkip(TIMING.DIALOG_LEAVE);
    dialog.classList.remove("active", "leaving");
    dialog.classList.add("hidden");
    if (activeDialogController === dialogController) {
      activeDialogController = null;
    }
    dialogController.dispose();
  }

  /**
   * Runs a sequence of dialogs, respecting blocking/duration semantics.
   * Each dialog object: { message, duration? }
   * If duration is omitted, dialog is blocking (user/skip).
   */
  async function runDialogs(dialogs) {
    for (const d of dialogs) {
      if (d.duration) {
        await showDialog(d.message, d.duration);
      } else if (d.blocking === false) {
        await showDialog(d.message, 1000); // default non-blocking duration
      } else {
        await showDialog(d.message);
      }
    }
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

      champion.updateUI({
        freeCostSkills: editMode?.freeCostSkills === true,
      });

      StatusIndicator.updateChampionIndicators(champion);

      syncChampionVFX(champion);
    }
  }

  function syncChampionFromSnapshot(champion, snap) {
    if (snap.portrait != undefined) {
      champion.portrait = snap.portrait;
    }

    // 🔥 HP só é aplicado se NÃO houve animação de dano
    if (snap.HP !== undefined) {
      champion.HP = snap.HP;
      champion.currentHp = snap.HP; // Para manter o currentHp em sincronia com o HP real do snapshot
    }

    if (snap.maxHP !== undefined) champion.maxHP = snap.maxHP;
    if (snap.Attack !== undefined) champion.Attack = snap.Attack;
    if (snap.Defense !== undefined) champion.Defense = snap.Defense;
    if (snap.Speed !== undefined) champion.Speed = snap.Speed;
    if (snap.Evasion !== undefined) champion.Evasion = snap.Evasion;
    if (snap.Critical !== undefined) champion.Critical = snap.Critical;
    if (snap.LifeSteal !== undefined) champion.LifeSteal = snap.LifeSteal;

    // Resource (ultMeter)
    if (snap.ultMeter !== undefined) champion.ultMeter = snap.ultMeter;

    // Runtime shields
    if (snap.runtime) {
      champion.runtime = {
        ...snap.runtime,
      };
    }

    // StatusEffects
    if (Array.isArray(snap.statusEffects)) {
      champion.statusEffects = new Map(snap.statusEffects);
    }

    // Alive
    if (snap.HP !== undefined) {
      champion.alive = snap.HP > 0;
    }

    if (snap.entityType !== undefined) {
      champion.entityType = snap.entityType;
      if (champion.el) champion.el.dataset.entityType = snap.entityType;
    }

    if (snap.name !== undefined && snap.name !== champion.name) {
      champion.name = snap.name;
      if (champion.el) {
        const nameEl = champion.el.querySelector(".champion-name");
        if (nameEl) nameEl.textContent = snap.name;
      }
    }

    if (snap.passive !== undefined) {
      champion.passive = snap.passive;
    }

    // Modifier data for UI indicators (buff/debuff arrows)
    if (snap.statModifiers !== undefined) {
      champion.statModifiers = snap.statModifiers;
    }
    if (snap.damageModifiersCount !== undefined) {
      champion.damageModifiersCount = snap.damageModifiersCount;
    }
    if (snap.damageReductionModifiersCount !== undefined) {
      champion.damageReductionModifiersCount =
        snap.damageReductionModifiersCount;
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
    console.log("🚨 GAME STATE UPDATE RECEIVED", gameState);

    if (!gameState) return;

    const { champions, currentTurn } = gameState;

    if (currentTurn !== undefined) {
      deps.setCurrentTurn(currentTurn);
      deps.updateTurnDisplay(currentTurn);
    }

    if (!Array.isArray(champions)) return;

    // Track which champion IDs are in the new gameState
    const newChampionIds = new Set(
      champions.map((c) => c?.id).filter((id) => id),
    );

    // 1. SYNC EXISTING CHAMPIONS E CRIAR NOVOS
    // Com o novo sistema de swap (inactiveChampions), Lana e Tutu têm IDs diferentes,
    // então nunca ocorre um "championKey mismatch" em um mesmo ID.
    // O bloco else-if abaixo é reservado para FUTURAS TRANSFORMAÇÕES (e.g., Lana → Lana_Evolved)
    // onde o MESMO objeto muda de tipo mas mantém o mesmo ID.
    for (const champData of champions) {
      if (!champData?.id) continue;

      let champion = deps.activeChampions.get(champData.id);

      if (!champion) {
        // NOVO CAMPEÃO: criar a partir do snapshot do servidor
        champion = deps.createNewChampion(champData);
      } else if (
        champData.championKey &&
        champion.championKey &&
        champion.championKey !== champData.championKey
      ) {
        // TRANSFORMAÇÃO (futuro): mesmo ID, tipo mudou — destruir e recriar
        // Ex: Lana (id=X) → Lana_Evolved (id=X)
        console.log(
          `[REPLACE DEBUG] Transformação detectada: ${champion.name} (id=${champData.id}) mudou de tipo ${champion.championKey} → ${champData.championKey}`,
        );
        champion.destroy();
        deps.activeChampions.delete(champData.id);
        champion = deps.createNewChampion(champData);
        deps.onChampionReplaced?.();
      }

      syncChampionFromSnapshot(champion, champData);

      champion.updateUI({
        freeCostSkills: editMode?.freeCostSkills === true,
      });

      syncChampionVFX(champion);
    }

    // 2. REMOVER CAMPEÕES QUE FORAM SWAPPED OUT
    // Com o novo sistema (swap via inactiveChampions), campeões swapped-out desaparecem do gameState.
    // Os seus objetos antigos no DOM devem ser destruídos.
    // Ex: Lana swap para inactiveChampions → seu ID já não está no gameState → remover do frontend.
    for (const [champId, champion] of deps.activeChampions) {
      if (!newChampionIds.has(champId)) {
        console.log(
          `[REPLACE DEBUG] Removendo ${champion.name} (id=${champId}) da renderização — foi swapped out para inactiveChampions no servidor.`,
        );
        champion.destroy();
        deps.activeChampions.delete(champId);
      }
    }

    // Keep status indicator loop on only when needed
    deps.syncStatusIndicatorRotation();

    deps.onGameStateProcessed?.();
  }

  // ============================================================
  //  TURN UPDATE
  // ============================================================

  function processTurnUpdate(turn) {
    deps.applyTurnUpdate(turn);
  }

  // ============================================================
  //  CHAMPION SWITCHED OUT (DESATIVADO)
  // ============================================================

  // async function processChampionSwitchedOut(championId) {
  //   const champion = deps.activeChampions.get(championId);
  //   if (!champion) return;
  //
  //   champion.el?.remove();
  //   champion.el = null;
  //   deps.activeChampions.delete(championId);
  // }

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

    if (!el) {
      console.log(
        `[AnimManager] Champion ${championId} removed but no element found.`,
      );
      return;
    }

    if (champion.runtime?.deathClaimTriggered) {
      // special vfx + dialog for Jeff_The_Death claim/special execution
      const name = formatChampionName(champion);

      await playDeathClaimEffect(el);

      await showDialog(`A Morte reclama ${name}!`);

      await wait(TIMING.DEATH_CLAIM_EFFECT);

      // normal death
    } else if (!el.dataset.obliterated && !el.dataset.finishing) {
      // Apply dying class — triggers CSS collapse animation
      el.classList.add("dying");

      // Wait for the death animation to play
      await wait(TIMING.DEATH_ANIM);
    }

    // Remove from DOM
    el.remove();
    champion.el = null;

    deps.activeChampions.delete(championId);
  }

  // ============================================================
  //  COMBAT LOG APPENDING
  //
  //  Manages the text-based combat log panel, including
  //  turn headers for visual separation between turns.
  // ============================================================

  function appendToLog(text) {
    console.log("[DEBUG] appendToLog called with:", text);
    if (!text) {
      console.warn("[DEBUG] appendToLog: text is falsy");
      return;
    }

    const log = document.getElementById("combat-log");
    if (!log) {
      console.warn("[DEBUG] appendToLog: #combat-log element not found");
      return;
    }

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
    // handleChampionSwitchedOut(championId) {
    //   enqueue("championSwitchedOut", championId);
    // },
    handleGameOver(data) {
      enqueue("gameOver", data);
    },
    handleCombatPhaseComplete() {
      enqueue("combatPhaseComplete", null);
    },
    appendToLog,
    reset,
  };
}
