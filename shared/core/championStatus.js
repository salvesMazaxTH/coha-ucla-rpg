import { StatusIndicator } from "../ui/statusIndicator.js";
import { StatusEffectsRegistry } from "../data/statusEffects/effectsRegistry.js";
import { emitCombatEvent } from "../engine/combat/combatEvents.js";
import { formatChampionName } from "../ui/formatters.js";

export function normalizeStatusEffectName(champion, statusEffectName) {
  if (typeof statusEffectName !== "string") return "";
  return statusEffectName.trim().toLowerCase();
}

/**
 * Auxiliary function for logs and interface
 * @param {string} statusEffectKey - Name of the statusEffect
 * @returns {string} - Formatted name for display
 */
function formatStatusDisplayName(statusEffectKey) {
  return statusEffectKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

  const behavior = StatusEffectsRegistry[statusEffectKey];
  if (!behavior) {
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
    // Only show dialog if the reason is NOT just 'already has effect and not stackable'
    // (i.e., suppress dialog spam for repeated attempts)
    if (validation.reason !== 'already-present') {
      context.registerDialog({
        message:
          validation.message ??
          `${formatChampionName(champion)} não pode receber "${statusEffectKey}".`,
        sourceId: champion.id,
        targetId: champion.id,
      });
    }
    return false;
  }

  const { currentTurn } = context || {};
  const isStackable = behavior.isStackable || false;

  if (!isStackable && hasStatusEffect(champion, statusEffectKey)) {
    return { allowed: false, reason: 'already-present' };
  }

  duration = Number.isFinite(duration) ? duration : 1;
  if (metadata?.persistent) duration = Infinity;

  champion.statusEffects.set(statusEffectKey, {
    expiresAtTurn: Number.isFinite(currentTurn) ? currentTurn + duration : NaN,
    duration,
    appliedAtTurn: currentTurn,
    ...metadata,
  });

  _attachStatusEffectBehavior(champion, statusEffectKey, duration, context);

  // Uso da nova função de display
  const statusDisplayName = formatStatusDisplayName(statusEffectKey);

  return {
    log: `${formatChampionName(champion)} recebeu <b>${statusDisplayName}</b>.`,
    statusEffectKey,
    targetId: champion.id,
    type: "statusEffectApply",
  };
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
      // Capitaliza a primeira letra e substitui underscores por espaço
      const statusDisplayName = statusEffectKey
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
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
