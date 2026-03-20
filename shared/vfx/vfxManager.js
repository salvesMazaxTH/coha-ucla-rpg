import { startShield } from "./shieldCanvas.js";
import { startFireStance } from "./fireStanceCanvas.js";
import { startFrozenCanvas } from "./frozenCanvas.js";
import { startWaterBubble } from "./waterBubbleCanvas.js";

// no futuro:
// import { startBurn } from "./burnCanvas.js";
// import { startFreeze } from "./freezeCanvas.js";

const VFXTriggers = {
  shield: (champion) =>
    Array.isArray(champion.runtime?.shields) &&
    champion.runtime.shields.length > 0,

  fireStanceIdle: (champion) => champion.runtime?.fireStance === "postura",

  fireStanceActive: (champion) => champion.runtime?.fireStance === "brasa_viva",

  congelado: (champion) => champion.statusEffects?.has("congelado"),

  waterBubble: (champion) => champion.runtime?.form === "bola_agua",
};

const activeEffects = new WeakMap();

export function syncChampionVFX(champion) {
  if (!champion?.el) return;
  if (!champion.el.isConnected) return;

  champion._vfxState ??= {};
  champion._vfxCanvases ??= {};

  for (const [type, trigger] of Object.entries(VFXTriggers)) {
    const shouldExist = trigger(champion);
    const exists = champion._vfxState[type];

    if (shouldExist && !exists) {
      const canvas = createVFXCanvas(type, champion);
      champion._vfxCanvases[type] = canvas;
      playVFX(type, canvas);
    }

    if (!shouldExist && exists) {
      removeVFXCanvas(champion, type);
    }

    champion._vfxState[type] = shouldExist;
  }
}

export function createVFXCanvas(type, champion) {
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

  if (type === "waterBubble") {
    const imgEl = container.querySelector(".portrait img");
    if (imgEl) imgEl.style.visibility = "hidden";
  }

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

    case "congelado":
      controller = startFrozenCanvas(canvas, data);
      break;

    // case "burn":
    //   controller = startBurn(canvas, data);
    //   break;

    case "fireStanceIdle":
    case "fireStanceActive":
      console.log("Starting fire stance VFX with type:", type);
      controller = startFireStance(canvas, { mode: type });
      break;

    case "waterBubble":
      controller = startWaterBubble(canvas, data);
      break;

    default:
      return;
  }

  activeEffects.set(canvas, controller);
}

function removeVFXCanvas(champion, key) {
  const canvas = champion._vfxCanvases?.[key];
  if (!canvas) return;

  if (key === "waterBubble") {
    const imgEl = champion.el?.querySelector(".portrait img");
    if (imgEl) imgEl.style.visibility = "";
  }

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
