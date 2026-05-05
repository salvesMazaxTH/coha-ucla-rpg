import { StatusEffectsRegistry } from "../data/statusEffects/effectsRegistry.js";
import { emitCombatEvent } from "../engine/combat/combatEvents.js";
import { formatChampionName } from "../ui/formatters.js";

const legacyStatusEffectAliases = {
  paralisado: "paralyzed",
  atordoado: "stunned",
  enraizado: "rooted",
  inerte: "inert",
  gelado: "chilled",
  congelado: "frozen",
  queimando: "burning",
  imunidadeabsoluta: "absoluteImmunity",
  "imunidade absoluta": "absoluteImmunity",
  condutor: "conductor",
  invisivel: "invisible",
  invisível: "invisible",
  envenenado: "poisoned",
  sangramento: "bleeding",
};

function normalizeStatusEffectKey(statusEffectKey) {
  if (typeof statusEffectKey !== "string") {
    return statusEffectKey;
  }

  const trimmedKey = statusEffectKey.trim();
  return legacyStatusEffectAliases[trimmedKey] || trimmedKey;
}

function getStatusEffectDefinition(statusEffectKey) {
  const canonicalKey = normalizeStatusEffectKey(statusEffectKey);
  return {
    canonicalKey,
    definition: StatusEffectsRegistry[canonicalKey] || null,
  };
}

function resolveStatusEffectDuration(duration, metadata = {}) {
  if (metadata?.persistent) return Infinity;
  return Number.isFinite(duration) ? duration : 1;
}

function buildStatusEffectApplyResult(
  champion,
  statusEffectKey,
  effectInstance,
) {
  const statusDisplayName = formatStatusDisplayName(statusEffectKey);
  const stackSuffix =
    Number.isFinite(effectInstance?.stacks) && effectInstance.stacks > 1
      ? ` x${effectInstance.stacks}`
      : "";

  return {
    log: `${formatChampionName(champion)} recebeu <b>${statusDisplayName}</b>${stackSuffix}.`,
    statusEffectKey,
    targetId: champion.id,
    type: "statusEffectApply",
    stacks: effectInstance?.stacks ?? 1,
  };
}

function reapplyStackableStatusEffect({
  champion,
  definition,
  canonicalStatusEffectKey,
  existingInstance,
  duration,
  context,
  metadata,
  stackCount,
}) {
  const nextDuration = resolveStatusEffectDuration(duration, metadata);

  if (typeof definition.reapplyInstance === "function") {
    return definition.reapplyInstance({
      owner: champion,
      existingInstance,
      duration: nextDuration,
      context,
      metadata,
      stackCount,
    });
  }

  existingInstance.stacks = Math.max(
    1,
    (Number(existingInstance.stacks) || 1) + stackCount,
  );
  existingInstance.appliedAtTurn = context?.currentTurn ?? 0;
  existingInstance.expiresAtTurn =
    nextDuration === Infinity
      ? Infinity
      : existingInstance.appliedAtTurn + nextDuration;
  existingInstance.metadata = {
    ...(existingInstance.metadata || {}),
    ...metadata,
    stacks: existingInstance.stacks,
    stackCount: existingInstance.stacks,
  };

  return existingInstance;
}

/**
 * Auxiliary function for logs and interface
 * @param {string} statusEffectKey - Name of the statusEffect
 * @returns {string} - Formatted name for display
 */
function formatStatusDisplayName(statusEffectKey) {
  const { canonicalKey, definition } =
    getStatusEffectDefinition(statusEffectKey);
  return (definition?.name || canonicalKey)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Apply a statusEffect effect to this champion
 * @param {object} champion - The champion instance
 * @param {string} statusEffectKey - Name of the statusEffect (e.g., 'inert', 'absoluteImmunity')
 * @param {number} duration - Number of turns the statusEffect lasts
 * @param {object} context - Context with currentTurn
 * @param {object} metadata - Additional data to store with the statusEffect, for example: persistent
 * @param {number} stackCount - Number of stacks to apply when the status supports stacking
 */
export function applyStatusEffect(
  champion,
  statusEffectKey,
  duration,
  context,
  metadata = {},
  stackCount = 1,
) {
  const canonicalStatusEffectKey = normalizeStatusEffectKey(statusEffectKey);
  const normalizedStackCount = Number.isFinite(stackCount)
    ? Math.max(1, Math.floor(stackCount))
    : 1;

  if (!(champion?.statusEffects instanceof Map)) {
    throw new TypeError(
      `[STATUS ERROR] Champion inválido ao aplicar status "${canonicalStatusEffectKey}".`,
    );
  }

  if (
    typeof canonicalStatusEffectKey !== "string" ||
    canonicalStatusEffectKey.length === 0
  ) {
    throw new TypeError(
      `[STATUS ERROR] statusEffectKey inválido: ${statusEffectKey}`,
    );
  }

  if (!context || typeof context !== "object") {
    throw new TypeError(
      `[STATUS ERROR] Context inválido ao aplicar status "${canonicalStatusEffectKey}".`,
    );
  }

  if (!Number.isFinite(context.currentTurn)) {
    throw new Error(
      `[STATUS ERROR] context.currentTurn inválido ao aplicar status "${canonicalStatusEffectKey}".`,
    );
  }

  if (normalizedStackCount < 1) {
    throw new Error(
      `[STATUS ERROR] stackCount inválido ao aplicar status "${canonicalStatusEffectKey}": ${stackCount}`,
    );
  }

  const definition = StatusEffectsRegistry[canonicalStatusEffectKey];
  if (!definition) {
    throw new Error(
      `[STATUS ERROR] StatusEffect "${canonicalStatusEffectKey}" não existe no registry`,
    );
  }

  if (
    typeof definition.key !== "string" ||
    definition.key !== canonicalStatusEffectKey
  ) {
    throw new Error(
      `[STATUS ERROR] Registry inconsistente: key "${canonicalStatusEffectKey}" não corresponde ao definition.key.`,
    );
  }

  const validation = _canApplyStatusEffect(
    champion,
    canonicalStatusEffectKey,
    duration,
    metadata,
    context,
  );

  if (!validation.allowed) {
    // Only show dialog if the reason is NOT just 'already has effect and not stackable'
    // (i.e., suppress dialog spam for repeated attempts)
    if (validation.reason !== "already-present") {
      context.registerDialog({
        message:
          validation.message ??
          `${formatChampionName(champion)} não pode receber "${formatStatusDisplayName(canonicalStatusEffectKey)}".`,
        sourceId: champion.id,
        targetId: champion.id,
      });
    }
    return false;
  }

  const isStackable = definition.isStackable || false;
  const existingInstance = champion.statusEffects.get(canonicalStatusEffectKey);

  if (!isStackable && existingInstance) {
    return false;
  }

  const durationFromStacks = definition.durationFromStacks === true;
  duration = durationFromStacks
    ? normalizedStackCount
    : resolveStatusEffectDuration(duration, metadata);

  if (isStackable && existingInstance) {
    const refreshedInstance = reapplyStackableStatusEffect({
      champion,
      definition,
      canonicalStatusEffectKey,
      existingInstance,
      duration,
      context,
      metadata,
      stackCount: normalizedStackCount,
    });

    if (!refreshedInstance || typeof refreshedInstance !== "object") {
      throw new Error(
        `[STATUS ERROR] Reaplicação de "${canonicalStatusEffectKey}" retornou instância inválida.`,
      );
    }

    champion.statusEffects.set(canonicalStatusEffectKey, refreshedInstance);
    return buildStatusEffectApplyResult(
      champion,
      canonicalStatusEffectKey,
      refreshedInstance,
    );
  }

  if (typeof definition.createInstance !== "function") {
    throw new Error(
      `[STATUS ERROR] StatusEffect "${canonicalStatusEffectKey}" não implementa createInstance().`,
    );
  }

  const effectInstance = definition.createInstance({
    owner: champion,
    duration,
    context,
    metadata: {
      ...metadata,
      stackCount: normalizedStackCount,
    },
  });

  if (!effectInstance || typeof effectInstance !== "object") {
    throw new Error(
      `[STATUS ERROR] createInstance() de "${canonicalStatusEffectKey}" retornou instância inválida.`,
    );
  }

  if (effectInstance.key !== canonicalStatusEffectKey) {
    throw new Error(
      `[STATUS ERROR] Instância de status inválida: key "${effectInstance.key}" difere de "${canonicalStatusEffectKey}".`,
    );
  }

  champion.statusEffects.set(canonicalStatusEffectKey, effectInstance);

  // Call onStatusEffectAdded if present
  if (typeof effectInstance.onStatusEffectAdded === "function") {
    effectInstance.onStatusEffectAdded({
      owner: champion,
      duration,
      context,
    });
  }

  return buildStatusEffectApplyResult(
    champion,
    canonicalStatusEffectKey,
    effectInstance,
  );
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
    return { allowed: false, reason: "shield-blocked" };
  }

  const canonicalStatusEffectKey = normalizeStatusEffectKey(statusEffectKey);
  const definition = StatusEffectsRegistry[canonicalStatusEffectKey];

  const eventResults = emitCombatEvent(
    "onStatusEffectIncoming",
    {
      target: champion,
      statusEffect: definition,
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
        `${formatChampionName(champion)} é imune a ${definition.name}.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if champion has an active statusEffect
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect
 * @returns {boolean}
 */
export function hasStatusEffect(champion, statusEffectName) {
  return champion.statusEffects.has(normalizeStatusEffectKey(statusEffectName));
}

/**
 * Get statusEffect data
 * @param {object} champion - The champion instance
 * @param {string} name - Name of the statusEffect
 * @returns {object|null}
 */
export function getStatusEffectData(champion, name) {
  return champion.statusEffects.get(normalizeStatusEffectKey(name)) || null;
}

/**
 * Get statusEffect data
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect
 * @returns {object|null}
 */
export function getStatusEffect(champion, statusEffectName) {
  return (
    champion.statusEffects.get(normalizeStatusEffectKey(statusEffectName)) ||
    null
  );
}

/**
 * Remove a statusEffect immediately
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect to remove
 */
export function removeStatusEffect(champion, statusEffectName) {
  const canonicalStatusEffectKey = normalizeStatusEffectKey(statusEffectName);

  if (champion.statusEffects.has(canonicalStatusEffectKey)) {
    champion.statusEffects.delete(canonicalStatusEffectKey);
    // No longer remove from runtime.hookEffects; status effect hooks are only in statusEffects Map now
    /* console.log(
      `[STATUS REMOVE] ${champion.name}: StatusEffect "${canonicalStatusEffectKey}" removido.`,
    );
    */
    // 🎨 Anima a remoção do indicador
    /*     StatusIndicator.animateIndicatorRemove(champion, statusEffectName); */
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
      // No longer remove from runtime.hookEffects; status effect hooks are only in statusEffects Map now
      // 🎨 Anima a remoção do indicador com delay visual
      /*       StatusIndicator.animateIndicatorRemove(champion, statusEffectName); */
    }
  }
  return removedStatusEffects;
}
