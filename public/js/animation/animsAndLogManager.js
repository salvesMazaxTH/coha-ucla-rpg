import { formatChampionName } from "../../../shared/ui/formatters.js";

import { syncChampionVFX } from "../../../shared/vfx/vfxManager.js";
import { playObliterateEffect } from "../../../shared/vfx/obliterate.js";
import { StatusIndicator } from "../../../shared/ui/statusIndicator.js";
import { playDeathClaimEffect } from "../../../shared/vfx/deathClaim.js";
import { audioManager } from "../utils/AudioManager.js";

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
    if (shouldShowLogDialog(text)) {
      const dialogText = stripHtmlTags(text);
      await showBlockingDialog(dialogText);
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
    console.log("[processCombatAction] ➡️ processCombatAction START");

    const { action, log, state, ...eventGroups } = envelope;

    // 1. Sempre exibe o dialog de uso da skill, independentemente de efeitos
    if (action) {
      currentPhase = "combat";

      if (typeof handleActionDialog === "function") {
        console.log("[processCombatAction] 💬 ACTION dialog");
        await handleActionDialog(action);
      }
    }

    // // reconstruir ordem real (versão com eventIndex)
    // const orderedEvents = [
    //   ...(eventGroups.damageEvents ?? []),
    //   ...(eventGroups.healEvents ?? []),
    //   ...(eventGroups.shieldEvents ?? []),
    //   ...(eventGroups.buffEvents ?? []),
    //   ...(eventGroups.resourceEvents ?? []),
    //   ...(eventGroups.dialogEvents ?? []),
    //   ...(eventGroups.redirectionEvents ?? []),
    // ].sort((a, b) => a.eventIndex - b.eventIndex);
    //
    // for (const event of orderedEvents) {
    //   switch (event.type) {
    //     case "damage":
    //       await animateDamage(event);
    //       break;
    //
    //     case "heal":
    //       await animateHeal(event);
    //       break;
    //
    //     case "shield":
    //       await animateShield(event);
    //       break;
    //
    //     case "buff":
    //       await animateBuff(event);
    //       break;
    //
    //     case "resourceGain":
    //     case "resourceSpend":
    //       animateResourceChange(event);
    //       break;
    //
    //     case "redirection":
    //       animateTauntRedirection(event);
    //       break;
    //
    //     case "dialog":
    //       if (event.blocking ?? true) {
    //         await showBlockingDialog(event.message);
    //       } else {
    //         showNonBlockingDialog(event.message);
    //         await wait(770);
    //       }
    //       break;
    //
    //     default:
    //       console.warn("Evento desconhecido:", event);
    //   }
    // }

    for (const [key, events] of Object.entries(eventGroups)) {
      if (!Array.isArray(events) || events.length === 0) continue;

      console.log(`[processCombatAction] 📚 GROUP: ${key} (${events.length})`);

      // 👇 tratamento especial
      if (key === "buffEvents") {
        await animateBuff(events[0]);
        continue; // pula o loop interno
      }

      for (let i = 0; i < events.length; i++) {
        const event = events[i];

        console.log("👉 EVENT:", key, event);

        switch (key) {
          case "damageEvents":
            console.log("💥 animateDamage START");
            await animateDamage(event);
            console.log("💥 animateDamage END");
            break;

          case "healEvents":
            await animateHeal(event);
            break;

          case "shieldEvents":
            await animateShield(event);
            break;

          /*           case "buffEvents":
            await animateBuff(event);
            break; */

          case "resourceEvents":
            animateResourceChange(event);
            break;

          case "redirectionEvents":
            animateTauntRedirection(event);
            break;

          case "dialogEvents":
            console.log("💬 dialog START");
            if (event.blocking ?? true) {
              await showBlockingDialog(event.message);
            } else {
              showNonBlockingDialog(event.message);
              await wait(770);
            }
            console.log("💬 dialog END");
            break;

          default:
            console.warn("Evento desconhecido:", key, event);
        }
      }
    }

    console.log("[processCombatAction] 📸 APPLY SNAPSHOT");
    if (state) applyStateSnapshots(state);

    console.log("[processCombatAction] 🧾 APPEND LOG");
    if (log) appendToLog(log);

    console.log("[processCombatAction] ⬅️ processCombatAction END");
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
    const { targetId, amount, isCritical, isDot, obliterate } = effect;
    const champion = deps.activeChampions.get(targetId);
    const championEl = getChampionElement(targetId);

    if (!championEl) return;
    // Garante que o alvo esteja visível antes de iniciar a animação
    const portraitWrapper = championEl.querySelector(".portrait-wrapper");
    const actualPortrait = portraitWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    // 1. Guardas de Interrupção (Evasão, Imunidade, Escudo)
    if (effect.evaded !== undefined) {
      await animateEvasion(effect);
      if (effect.evaded) return;
    }
    if (effect.immune) return await animateImmune(effect);
    if (effect.shieldBlocked) return await animateShieldBlock(effect);
    if (!obliterate && (!amount || amount <= 0)) return;

    const targetName = champion ? formatChampionName(champion) : "Alvo";

    // 2. Diálogos de pré-dano (DoT)
    if (isDot) await showBlockingDialog(`${targetName} sofreu dano.`, true);

    // 3. Feedback Visual Imediato (Shake/Piscar e Float)
    championEl.classList.add("damage");
    audioManager.play("damage");

    if (portraitWrapper) {
      const floatValue = obliterate ? "999" : `-${amount}`;
      const extraClass = obliterate
        ? "obliterate"
        : `damage-tier-${getDamageTier(amount)}`;
      createFloatElement(
        portraitWrapper,
        floatValue,
        "damage-float",
        extraClass,
      );
    }

    // 4. Atualização de Estado e Animações Específicas
    if (obliterate) {
      updateVisualHP(targetId, -champion.currentHp, 0);
      await playObliterateEffect(championEl);
      championEl.dataset.obliterated = "true";
    } else {
      updateVisualHP(targetId, -amount);
      if (isCritical) {
        await showBlockingDialog(
          `UM ACERTO CRÍTICO! ${targetName} sofreu um dano devastador!`,
          true,
        );
      }
      // Espera o fim da animação de "damage" (shake) e um respiro
      await waitForAnimation(championEl, 600);
      await wait(450);
      championEl.classList.remove("damage");
    }
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

    // showNonBlockingDialog(`${targetName} recuperou vida.`, true);

    await showBlockingDialog(`${targetName} recuperou vida.`, true);

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

    await showBlockingDialog(`${name} tentou esquivar o ataque...`, true);

    if (evaded) {
      // 🔥 INICIA A ANIMAÇÃO
      championEl.classList.add("evasion");

      // 🔥 Espera a animação CSS terminar de verdade
      await waitForAnimation(championEl, 600);

      championEl.classList.remove("evasion");
      await showBlockingDialog(`${name} CONSEGUIU esquivar o ataque!!`, true);
      // meme/trollagem
      await showBlockingDialog(`e conseguiu!`, true);
      const randomTrollMessage = Math.random();
      if (randomTrollMessage < 0.5) {
        await showBlockingDialog(`e conseguiu!!`, true);
        await showBlockingDialog(`e conseguiu!!! 🤗`, true);
        await showBlockingDialog(`e conseguiu!!! 🥳`, true);
      } else {
        await showBlockingDialog(
          `...mas foi tão ruim que tropeçou e caiu no chão.`,
          true,
        );
      }
    } else {
      await showBlockingDialog(`...mas falhou em esquivar.`, true);
    }
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
    const actualPortrait = portraitWrapper.querySelector(".portrait");
    scrollIfNeeded(actualPortrait, { threshold: 0.85 });

    const champion = deps.activeChampions.get(targetId);

    const name = champion ? formatChampionName(champion) : "Alvo";
    // showNonBlockingDialog(`${name} recebeu um escudo.`, true);
    await showBlockingDialog(`${name} recebeu um escudo.`, true);

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
    await showBlockingDialog(message, true);
  }

  // ============================================================
  //  SHIELD BLOCK ANIMATION
  // ============================================================

  async function animateShieldBlock(effect) {
    const { targetId } = effect;
    const champion = deps.activeChampions.get(targetId);
    const name = champion ? formatChampionName(champion) : "Alvo";
    // showNonBlockingDialog(`O escudo de ${name} bloqueou o ataque!`, true);
    await showBlockingDialog(`O escudo de ${name} bloqueou o ataque!`, true);
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
    // showNonBlockingDialog(text, true);
    await showBlockingDialog(text, true);

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
    // showNonBlockingDialog(
    //   `${name} foi <b>provocado</b> e teve seu alvo redirecionado!`,
    //   true,
    // );
    await showBlockingDialog(
      `${name} foi <b>provocado</b> e teve seu alvo redirecionado!`,
      true,
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

  function updateVisualHP(championId, delta, currentVisualHP = null) {
    delta = Number(delta) || 0;

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
    const match = hpText.match(/^(\d+)\/(\d+)/);
    if (!match) return;

    currentVisualHP =
      currentVisualHP !== null ? currentVisualHP : parseInt(match[1], 10);

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

  function updateVisualResource(championId, deltaUnits) {
    const el = getChampionElement(championId);
    if (!el) return;

    const fill = el.querySelector(".ult-fill");
    if (!fill) return;

    // 🔹 Cap fixo do sistema
    const MAX_UNITS = 15;
    const UNITS_PER_BAR = 3;

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

    // Resolve usuário pelo estado atual (preferível ao nome cru)
    const userChampion = deps.activeChampions.get(userId);
    const resolvedUserName = userChampion
      ? formatChampionName(userChampion)
      : userName || "Alguém";

    const resolvedSkillName = skillName
      ? `<b>${typeof skillName === "object" ? skillName.name : skillName}</b>`
      : "<b>uma habilidade</b>";

    let dialogText;

    // Se tiver alvo e não for self-target
    if (targetId && targetId !== userId) {
      const targetChampion = deps.activeChampions.get(targetId);

      const resolvedTargetName =
        targetName ||
        (targetChampion ? formatChampionName(targetChampion) : "Alvo");

      dialogText = `${resolvedUserName} usou ${resolvedSkillName} em ${resolvedTargetName}.`;
    } else {
      dialogText = `${resolvedUserName} usou ${resolvedSkillName}.`;
    }

    await showBlockingDialog(dialogText, true);
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

  async function showBlockingDialog(text) {
    const dialog = deps.combatDialog;
    const dialogText = deps.combatDialogText;
    if (!dialog || !dialogText) return;

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

  async function showNonBlockingDialog(text) {
    const dialog = deps.combatDialog;
    const dialogText = deps.combatDialogText;
    if (!dialog || !dialogText) return;

    dialogText.innerHTML = text;

    dialog.classList.remove("hidden", "leaving");
    dialog.classList.add("active");

    await wait(500);
    setTimeout(() => {
      dialog.classList.add("leaving");

      setTimeout(() => {
        dialog.classList.remove("active", "leaving");
        dialog.classList.add("hidden");
      }, TIMING.DIALOG_LEAVE);
    }, TIMING.DIALOG_DISPLAY);
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

    for (const champData of champions) {
      if (!champData?.id) continue;

      let champion = deps.activeChampions.get(champData.id);

      if (!champion) {
        champion = deps.createNewChampion(champData);
      }

      syncChampionFromSnapshot(champion, champData);

      champion.updateUI({
        freeCostSkills: editMode?.freeCostSkills === true,
      });

      syncChampionVFX(champion);
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

      playDeathClaimEffect(el);

      await showBlockingDialog(`A Morte reclama ${name}!`);

      await wait(TIMING.DEATH_CLAIM_EFFECT);

      // normal death
    } else if (!el.dataset.obliterated) {
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
