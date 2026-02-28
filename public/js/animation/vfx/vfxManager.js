import { startShield } from "./shieldCanvas.js";
import { startFireStance } from "./fireStanceCanvas.js";
// no futuro:
// import { startBurn } from "./burnCanvas.js";
// import { startFreeze } from "./freezeCanvas.js";

const activeEffects = new WeakMap();

export function syncChampionVFX(champion) {
  console.log("Syncing VFX for champion:", champion.id);

  if (!champion?.el) return;

  const canvas = champion.el.querySelector(".vfx-layer");
  if (!canvas) return;

  const runtime = champion.runtime || {};

  const currentState = {
    shield: Array.isArray(runtime.shields) && runtime.shields.length > 0,
    fireStance: runtime.fireStance || null, // agora pode ser string
  };

  champion._vfxState ??= {};

  // =========================
  // SHIELD (continua boolean)
  // =========================
  if (currentState.shield && !champion._vfxState.shield) {
    playVFX("shield", canvas);
  }

  if (!currentState.shield && champion._vfxState.shield) {
    stopVFX(canvas);
  }

  champion._vfxState.shield = currentState.shield;

  // =========================
  // FIRE STANCE (agora faseada)
  // =========================

  const previousFireState = champion._vfxState.fireStance;
  const newFireState = currentState.fireStance;

  if (previousFireState !== newFireState) {
    // Sempre para o anterior se existir
    if (previousFireState) {
      stopVFX(canvas);
    }

    if (newFireState === "postura") {
      playVFX("fireStanceIdle", canvas);
    }

    if (newFireState === "brasa_viva") {
      playVFX("fireStanceActive", canvas);
    }
  }

  champion._vfxState.fireStance = newFireState;
}

export function playVFX(type, canvas, data = {}) {
  if (!canvas) return;

  stopVFX(canvas);

  let controller;

  switch (type) {
    case "shield":
      controller = startShield(canvas, data);
      break;

    // case "burn":
    //   controller = startBurn(canvas, data);
    //   break;

    case "fireStanceIdle":
    case "fireStanceActive":
      console.log("Starting fire stance VFX with type:", type);
      controller = startFireStance(canvas, { mode: type });
      break;

    default:
      return;
  }

  activeEffects.set(canvas, controller);
}

export function stopVFX(canvas) {
  const controller = activeEffects.get(canvas);
  if (controller && controller.stop) {
    controller.stop();
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  activeEffects.delete(canvas);
}
