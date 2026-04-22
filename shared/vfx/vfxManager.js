/**
 * PADRÃO DE TRIGGERS DE VFX
 *
 * Existem dois grupos de triggers para efeitos visuais (VFX):
 *
 * 1. StatusEffectVFX: lista de status effects genéricos que ativam VFX automaticamente.
 *    Basta adicionar o nome do status effect na lista para ativar o VFX correspondente.
 *    Exemplo: "frozen".
 *
 * 2. ExclusiveVFXTriggers: triggers exclusivos para efeitos que NÃO são status effects genéricos,
 *    mas sim estados runtime, marcas especiais ou efeitos únicos de personagem/habilidade.
 *    Exemplo: shield, fireStanceIdle, waterBubble, etc.
 *
 * Para adicionar um novo VFX de status effect:
 *   - Adicione o nome do status effect em StatusEffectVFX.
 *   - Implemente a função playVFX correspondente.
 *
 * Para adicionar um novo VFX exclusivo:
 *   - Adicione um trigger em ExclusiveVFXTriggers seguindo o critério acima.
 *
 * syncChampionVFX cuida de ativar/desativar ambos os grupos automaticamente.
 */
import { startShield } from "./shieldCanvas.js";
import { startFireStance } from "./fireStanceCanvas.js";
import { startFrozenCanvas } from "./frozenCanvas.js";
import { startWaterBubble } from "./waterBubbleCanvas.js";
import { startAbraçoDaMorteMark } from "./abracoDaMorteMarkCanvas.js";
import { startInevitabilidadeDaMorte } from "./inevitabilidadeDaMorteCanvas.js";
import { startInvisibilityCanvas } from "./invisibilityCanvas.js";

// no futuro:
// import { startBurn } from "./burnCanvas.js";
// import { startFreeze } from "./freezeCanvas.js";

// Triggers automáticos para status effects genéricos (nome do status effect === nome do VFX)
const StatusEffectVFX = [
  "frozen",
  "invisible",
  // Adicione outros status effects que tenham VFX próprios aqui
];

// Triggers exclusivos/habilidades:
// Use esta estrutura para efeitos visuais que NÃO são status effects genéricos,
// mas sim estados runtime, marcas especiais, ou efeitos únicos de personagem/habilidade.
// Critério: se não for status effect padronizado, coloque aqui.
const ExclusiveVFXTriggers = {
  shield: (champion) =>
    Array.isArray(champion.runtime?.shields) &&
    champion.runtime.shields.length > 0,

  fireStanceIdle: (champion) => champion.runtime?.fireStance === "postura",

  fireStanceActive: (champion) => champion.runtime?.fireStance === "brasa_viva",

  waterBubble: (champion) => champion.runtime?.form === "bola_agua",

  abracoDaMorteMark: (champion) => champion.runtime?.markedByAbraçoDaMorte,

  inevitabilidadeDaMorteMark: (champion) =>
    champion.runtime?.markedByInevitabilidadeDaMorte,
  // Adicione outros triggers exclusivos seguindo o critério acima
};

const activeEffects = new WeakMap();

function getShieldVFXData(champion) {
  const shields = Array.isArray(champion.runtime?.shields)
    ? champion.runtime.shields
    : [];

  const variant = shields.some((shield) => shield?.type === "spell")
    ? "spell"
    : "regular";

  return {
    variant,
    stateKey: shields.length > 0 ? `shield:${variant}` : false,
  };
}

export function syncChampionVFX(champion) {
  if (!champion?.el) return;
  if (!champion.el.isConnected) return;

  champion._vfxState ??= {};
  champion._vfxCanvases ??= {};

  // 1. Automatizar triggers de status effects
  for (const type of StatusEffectVFX) {
    const shouldExist = champion.statusEffects?.has(type);
    const exists = champion._vfxState[type];

    if (type === "invisible") {
      champion.el.classList.toggle("is-invisible", !!shouldExist);
    }

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

  // 2. Triggers exclusivos/habilidades
  for (const [type, trigger] of Object.entries(ExclusiveVFXTriggers)) {
    const shouldExist = trigger(champion);
    const vfxData = type === "shield" ? getShieldVFXData(champion) : null;
    const nextState = type === "shield" ? vfxData.stateKey : shouldExist;
    const exists = champion._vfxState[type] === nextState;
    const hadCanvas = !!champion._vfxCanvases?.[type];

    if (shouldExist && !exists) {
      if (hadCanvas) {
        removeVFXCanvas(champion, type);
      }

      const canvas = createVFXCanvas(type, champion);
      champion._vfxCanvases[type] = canvas;
      playVFX(type, canvas, vfxData || {});
    }

    if (!shouldExist && hadCanvas) {
      removeVFXCanvas(champion, type);
    }

    champion._vfxState[type] = nextState;
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

    case "frozen":
      controller = startFrozenCanvas(canvas, data);
      break;

    case "invisible":
      controller = startInvisibilityCanvas(canvas, data);
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

    case "abracoDaMorteMark":
      controller = startAbraçoDaMorteMark(canvas, data);
      break;

    case "inevitabilidadeDaMorteMark":
      controller = startInevitabilidadeDaMorte(canvas, data);
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

  if (key === "invisible") {
    champion.el?.classList.remove("is-invisible");
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
