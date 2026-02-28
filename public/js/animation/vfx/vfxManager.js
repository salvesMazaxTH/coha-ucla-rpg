import { startShield } from "./shieldCanvas.js";
import { startFireStance } from "./fireStanceCanvas.js";
// no futuro:
// import { startBurn } from "./burnCanvas.js";
// import { startFreeze } from "./freezeCanvas.js";

const activeEffects = new WeakMap();

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
    
    case "fireStance":
      controller = startFireStance(canvas, data);
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