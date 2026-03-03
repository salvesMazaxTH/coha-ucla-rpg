import { startShield } from "./shieldCanvas.js";
import { startFireStance } from "./fireStanceCanvas.js";

// no futuro:
// import { startBurn } from "./burnCanvas.js";
// import { startFreeze } from "./freezeCanvas.js";

const activeEffects = new WeakMap();

export function syncChampionVFX(champion) {
  if (!champion?.el) return;
  if (!champion.el.isConnected) return;

  const runtime = champion.runtime || {};

  champion._vfxState ??= {};
  champion._vfxCanvases ??= {};

  // =========================
  // 🛡 SHIELD
  // =========================
  const hasShield =
    Array.isArray(runtime.shields) && runtime.shields.length > 0;

  if (hasShield && !champion._vfxState.shield) {
    const canvas = createVFXCanvas("shield", champion);
    champion._vfxCanvases.shield = canvas;
    playVFX("shield", canvas);
  }

  if (!hasShield && champion._vfxState.shield) {
    removeVFXCanvas(champion, "shield");
  }

  champion._vfxState.shield = hasShield;

  // =========================
  // 🔥 FIRE STANCE
  // =========================
  const previousFire = champion._vfxState.fireStance || null;
  const newFire = runtime.fireStance || null;

  if (previousFire !== newFire) {
    removeVFXCanvas(champion, "fireStance");

    if (newFire === "postura") {
      const canvas = createVFXCanvas("fireStanceIdle", champion);
      champion._vfxCanvases.fireStance = canvas;
      playVFX("fireStanceIdle", canvas);
    }

    if (newFire === "brasa_viva") {
      const canvas = createVFXCanvas("fireStanceActive", champion);
      champion._vfxCanvases.fireStance = canvas;
      playVFX("fireStanceActive", canvas);
    }
  }

  champion._vfxState.fireStance = newFire;
}

function createVFXCanvas(type, champion) {
  const container = champion.el.querySelector(".portrait-wrapper");
  if (!container) return null;

  const canvas = document.createElement("canvas");

  // 🔒 GARANTIA ABSOLUTA DE CLASSES
  canvas.classList.add(
    "vfx-canvas", // ← obrigatória
    "vfx-layer", // ← camada base
    `vfx-${type}`, // ← específica
  );

  canvas.style.zIndex = "10";

  container.appendChild(canvas);

  return canvas;
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

function removeVFXCanvas(champion, key) {
  const canvas = champion._vfxCanvases?.[key];
  if (!canvas) return;

  stopVFX(canvas);
  canvas.remove();

  delete champion._vfxCanvases[key];
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
