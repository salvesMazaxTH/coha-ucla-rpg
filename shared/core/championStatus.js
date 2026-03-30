import { StatusIndicator } from "../ui/statusIndicator.js";
import { StatusEffectsRegistry } from "../data/statusEffects/effectsRegistry.js";
import { emitCombatEvent } from "../engine/combat/combatEvents.js";
import { formatChampionName } from "../ui/formatters.js";

export function normalizeStatusEffectName(champion, statusEffectName) {
  if (typeof statusEffectName !== "string") return "";
  return statusEffectName.trim().toLowerCase();
}

/**
 * Apply a statusEffect effect to this champion
 * @param {object} champion - The champion instance
 * @param {string} statusEffectKey - Name of the statusEffect (e.g., 'inerte', 'imunidade absoluta')
 * @param {number} duration - Number of turns the statusEffect lasts
 * @param {object} context - Context with currentTurn
 * @param {object} metadata - Additional data to store with the statusEffect, for example: persistent
 */
export function applyStatusEffect(
  champion,
  statusEffectKey,
  duration,
  context,
  metadata = {},
) {
  if (!statusEffectKey) return false;
  if (!StatusEffectsRegistry[statusEffectKey]) {
    throw new Error(
      `[STATUS ERROR] StatusEffect "${statusEffectKey}" não existe no registry`,
    );
  }

  const validation = _canApplyStatusEffect(
    champion,
    statusEffectKey,
    duration,
    metadata,
    context,
  );

  if (!validation.allowed) {
    context.registerDialog({
      message:
        validation.message ??
        `${formatChampionName(champion)} não pode receber "${statusEffectKey}".`,
      sourceId: champion.id,
      targetId: champion.id,
    });

    return false;
  }

  const { currentTurn } = context || {};

  const isStackable =
    StatusEffectsRegistry[statusEffectKey].isStackable || false;

  if (!isStackable && hasStatusEffect(champion, statusEffectKey)) {
    return;
  }

  console.log(
    `[STATUS APPLY] ${champion.name} tentando receber "${statusEffectKey}" (duration=${duration})`,
  );

  duration = Number.isFinite(duration) ? duration : 1;

  const persistent = metadata?.persistent || false;
  if (persistent) duration = Infinity;

  champion.statusEffects.set(statusEffectKey, {
    expiresAtTurn: Number.isFinite(currentTurn)
      ? currentTurn + Number(duration || 0)
      : NaN,
    duration,
    appliedAtTurn: currentTurn,
    ...metadata,
  });

  /* console.log(
    `[STATUS APPLY] ${champion.name} recebeu "${statusEffectKey}" até turno ${currentTurn + duration}`,
  );
  */
  _attachStatusEffectBehavior(champion, statusEffectKey, duration, context);

  console.log("STATUS MAP:", [...champion.statusEffects.keys()]);
  console.log(
    "HOOK EFFECTS:",
    champion.runtime.hookEffects.map((e) => e.key),
  );

  context.registerDialog({
    message: `${formatChampionName(champion)} recebeu "<b>${statusEffectKey.charAt(0).toUpperCase() + statusEffectKey.slice(1)}</b>".`,
    sourceId: champion.id,
    targetId: champion.id,
    timing: "post",
  });

  return true;
}

function _canApplyStatusEffect(
  champion,
  statusEffectKey,
  duration,
  metadata,
  context,
) {
  if (context?.shieldBlockedTargets?.has(champion.id)) {
    /* console.log(
      `[STATUS BLOCKED] ${champion.name}: statusEffect "${statusEffectKey}" bloqueado por escudo.`,
    );
    */
    return false;
  }

  const behavior = StatusEffectsRegistry[statusEffectKey];

  if (!behavior) {
    console.warn(
      `[STATUS ERROR] StatusEffect "${statusEffectKey}" não encontrado no registry.`,
    );
    return false;
  }

  const eventResults = emitCombatEvent(
    "onStatusEffectIncoming",
    {
      target: champion,
      statusEffect: behavior,
      duration,
      metadata,
      context,
    },
    context?.allChampions,
  );

  const cancelled = eventResults.find((r) => r?.cancel);

  if (cancelled) {
    return {
      allowed: false,
      message:
        cancelled.message ??
        `${formatChampionName(champion)} é imune a ${behavior.name}.`,
    };
  }

  if (behavior?.subtypes?.includes("hardCC")) {
    for (const [existingStatusEffect] of champion.statusEffects) {
      const existingBehavior = StatusEffectsRegistry[existingStatusEffect];

      if (existingBehavior?.subtypes?.includes("hardCC")) {
        return {
          allowed: false,
          /*          message: `${champion.name} já está incapacitado.`, */
        };
      }
    }
  }

  return { allowed: true };
}

function _attachStatusEffectBehavior(
  champion,
  statusEffectKey,
  duration,
  context,
) {
  /* console.log(
    `[STATUS HOOK] Instalando hooks de "${statusEffectKey}" em ${champion.name}`,
  );
  */
  const behavior = StatusEffectsRegistry[statusEffectKey];
  if (!behavior) return;

  const isStackable = statusEffectKey === "poison";

  const effectInstance = {
    key: statusEffectKey,
    group: "statusEffect",
    source: statusEffectKey,
    ownerId: champion.id,
    ...behavior,
  };

  champion.runtime ??= {};
  champion.runtime.hookEffects ??= [];

  if (!isStackable) {
    champion.runtime.hookEffects = champion.runtime.hookEffects.filter(
      (e) => e.key !== statusEffectKey,
    );
  }

  champion.runtime.hookEffects.push(effectInstance);

  /* console.log(
    `[STATUS HOOK] Hooks ativos de ${champion.name}:`,
    champion.runtime.hookEffects.map((e) => e.key),
  );
  */
  if (behavior.onStatusEffectAdded) {
    behavior.onStatusEffectAdded({
      owner: champion,
      duration,
      context,
    });
  }
}

/**
 * Check if champion has an active statusEffect
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect
 * @returns {boolean}
 */
export function hasStatusEffect(champion, statusEffectName) {
  return champion.statusEffects.has(
    normalizeStatusEffectName(champion, statusEffectName),
  );
}

/**
 * Get statusEffect data
 * @param {object} champion - The champion instance
 * @param {string} name - Name of the statusEffect
 * @returns {object|null}
 */
export function getStatusEffectData(champion, name) {
  const normalized = normalizeStatusEffectName(champion, name);
  return champion.statusEffects.get(normalized) || null;
}

/**
 * Get statusEffect data
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect
 * @returns {object|null}
 */
export function getStatusEffect(champion, statusEffectName) {
  return (
    champion.statusEffects.get(
      normalizeStatusEffectName(champion, statusEffectName),
    ) || null
  );
}

/**
 * Remove a statusEffect immediately
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect to remove
 */
export function removeStatusEffect(champion, statusEffectName) {
  const normalizedName = normalizeStatusEffectName(champion, statusEffectName);
  if (champion.statusEffects.has(normalizedName)) {
    champion.statusEffects.delete(normalizedName);

    champion.runtime.hookEffects = champion.runtime.hookEffects.filter(
      (e) => !(e.group === "statusEffect" && e.key === statusEffectName),
    );

    /* console.log(
      `[STATUS REMOVE] ${champion.name}: StatusEffect "${normalizedName}" removido.`,
    );
    */
    // 🎨 Anima a remoção do indicador
    /*     StatusIndicator.animateIndicatorRemove(champion, normalizedName); */
  }
}

/**
 * Purge all expired statusEffects at turn end
 * @param {object} champion - The champion instance
 * @param {number} currentTurn - Current turn number
 * @returns {array} List of removed statusEffect names
 */
export function purgeExpiredStatusEffects(champion, currentTurn) {
  const removedStatusEffects = [];
  for (const [
    statusEffectName,
    statusEffectData,
  ] of champion.statusEffects.entries()) {
    if (statusEffectData.expiresAtTurn <= currentTurn) {
      champion.statusEffects.delete(statusEffectName);
      removedStatusEffects.push(statusEffectName);
      /* console.log(
        `[STATUS EXPIRE] ${champion.name}: StatusEffect "${statusEffectName}" expirou.`,
      );
      */
      champion.runtime.hookEffects = champion.runtime.hookEffects.filter(
        (e) => !(e.group === "statusEffect" && e.key === statusEffectName),
      );

      // 🎨 Anima a remoção do indicador com delay visual
      /*       StatusIndicator.animateIndicatorRemove(champion, statusEffectName); */
    }
  }
  return removedStatusEffects;
}
