import { StatusEffectsRegistry } from "../data/statusEffects/effectsRegistry.js";
import { emitCombatEvent } from "../engine/combat/combatEvents.js";
import { formatChampionName } from "../ui/formatters.js";

function resolveStatusEffectDuration(duration, metadata = {}) {
  if (metadata?.persistent) return Infinity;
  return Number.isFinite(duration) ? duration : 1;
}

function buildStatusEffectApplyResult(
  champion,
  statusEffectKey,
  effectInstance,
) {
  const def = StatusEffectsRegistry[statusEffectKey];
  const statusDisplayName = (def?.name || statusEffectKey)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

function resolveStatusEffectSource(context, metadata = {}) {
  const sourceId = metadata?.sourceId ?? context?.actionSource?.id ?? null;
  if (!sourceId) return context?.actionSource ?? context?.source ?? null;

  const champions = context?.allChampions;
  if (champions instanceof Map) {
    return (
      champions.get(sourceId) ??
      context?.actionSource ??
      context?.source ??
      null
    );
  }

  if (Array.isArray(champions)) {
    return (
      champions.find((champion) => champion?.id === sourceId) ??
      context?.actionSource ??
      context?.source ??
      null
    );
  }

  return context?.actionSource ?? context?.source ?? null;
}

function assertStatusPreconditions(champion, statusEffectKey, context) {
  if (!(champion?.statusEffects instanceof Map)) {
    throw new TypeError(
      `[STATUS ERROR] Champion inválido ao aplicar status "${statusEffectKey}".`,
    );
  }

  if (typeof statusEffectKey !== "string" || statusEffectKey.length === 0) {
    throw new TypeError(
      `[STATUS ERROR] statusEffectKey inválido: ${statusEffectKey}`,
    );
  }

  if (!context || typeof context !== "object") {
    throw new TypeError(
      `[STATUS ERROR] Context inválido ao aplicar status "${statusEffectKey}".`,
    );
  }

  if (!Number.isFinite(context.currentTurn)) {
    throw new Error(
      `[STATUS ERROR] context.currentTurn inválido ao aplicar status "${statusEffectKey}".`,
    );
  }

  const definition = StatusEffectsRegistry[statusEffectKey];

  if (!definition) {
    throw new Error(
      `[STATUS ERROR] StatusEffect "${statusEffectKey}" não existe no registry`,
    );
  }

  if (definition.key !== statusEffectKey) {
    throw new Error(
      `[STATUS ERROR] Registry inconsistente: key "${statusEffectKey}" não corresponde ao definition.key.`,
    );
  }

  return definition;
}

function applyStatusEffectCore({
  champion,
  definition,
  statusEffectKey,
  duration,
  context,
  metadata,
  normalizedStackCount,
}) {
  const isStackable = definition.isStackable || false;
  const existingInstance = champion.statusEffects.get(statusEffectKey);

  if (!isStackable && existingInstance) {
    return false;
  }

  const durationFromStacks = definition.durationFromStacks === true;

  const resolvedDuration = durationFromStacks
    ? normalizedStackCount
    : resolveStatusEffectDuration(duration, metadata);

  if (isStackable && existingInstance) {
    return applyStackUpdate({
      champion,
      existingInstance,
      statusEffectKey,
      context,
      metadata,
      normalizedStackCount,
      resolvedDuration,
      durationFromStacks,
    });
  }

  if (typeof definition.createInstance !== "function") {
    throw new Error(
      `[STATUS ERROR] StatusEffect "${statusEffectKey}" não implementa createInstance().`,
    );
  }

  const effectInstance = definition.createInstance({
    owner: champion,
    duration: resolvedDuration,
    context,
    metadata: {
      ...metadata,
      stackCount: normalizedStackCount,
    },
  });

  if (!effectInstance || typeof effectInstance !== "object") {
    throw new Error(
      `[STATUS ERROR] createInstance() de "${statusEffectKey}" retornou instância inválida.`,
    );
  }

  if (effectInstance.key !== statusEffectKey) {
    throw new Error(
      `[STATUS ERROR] Instância de status inválida: key "${effectInstance.key}" difere de "${statusEffectKey}".`,
    );
  }

  if (durationFromStacks) {
    // Stack-bound effects only expire when stacks reach zero in onTurnStart.
    effectInstance.expiresAtTurn = Infinity;
  }

  champion.statusEffects.set(statusEffectKey, effectInstance);

  if (typeof effectInstance.onStatusEffectAdded === "function") {
    effectInstance.onStatusEffectAdded({
      owner: champion,
      duration: resolvedDuration,
      context,
    });
  }

  emitCombatEvent(
    "onStatusEffectApplied",
    {
      target: champion,
      source: resolveStatusEffectSource(context, metadata),
      sourceId: metadata?.sourceId ?? context?.actionSource?.id ?? null,
      statusEffect: definition,
      statusEffectKey,
      effectInstance,
      stacks: effectInstance?.stacks ?? normalizedStackCount,
      context,
      metadata,
    },
    context?.allChampions,
  );

  return buildStatusEffectApplyResult(
    champion,
    statusEffectKey,
    effectInstance,
  );
}

function applyStackUpdate({
  champion,
  existingInstance,
  statusEffectKey,
  context,
  metadata,
  normalizedStackCount,
  resolvedDuration,
  durationFromStacks,
}) {
  const newStacks = Math.max(
    1,
    (Number(existingInstance.stacks) || 1) + normalizedStackCount,
  );

  existingInstance.stacks = newStacks;
  existingInstance.stackCount = newStacks;
  existingInstance.appliedAtTurn = context.currentTurn;

  if (!durationFromStacks) {
    existingInstance.expiresAtTurn =
      resolvedDuration === Infinity
        ? Infinity
        : context.currentTurn + resolvedDuration;
  }

  existingInstance.metadata = {
    ...(existingInstance.metadata || {}),
    ...metadata,
    stacks: newStacks,
    stackCount: newStacks,
  };

  champion.statusEffects.set(statusEffectKey, existingInstance);

  emitCombatEvent(
    "onStatusEffectApplied",
    {
      target: champion,
      source: resolveStatusEffectSource(context, metadata),
      sourceId: metadata?.sourceId ?? context?.actionSource?.id ?? null,
      statusEffect: StatusEffectsRegistry[statusEffectKey],
      statusEffectKey,
      effectInstance: existingInstance,
      stacks: existingInstance?.stacks ?? newStacks,
      context,
      metadata,
    },
    context?.allChampions,
  );

  return buildStatusEffectApplyResult(
    champion,
    statusEffectKey,
    existingInstance,
  );
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
  const normalizedStackCount = Number.isFinite(stackCount)
    ? Math.max(1, Math.floor(stackCount))
    : 1;
  const definition = assertStatusPreconditions(
    champion,
    statusEffectKey,
    context,
  );

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
        `${formatChampionName(champion)} não pode receber "${definition?.name || statusEffectKey}".`,
      sourceId: champion.id,
      targetId: champion.id,
    });
    return false;
  }

  return applyStatusEffectCore({
    champion,
    definition,
    statusEffectKey,
    duration,
    context,
    metadata,
    normalizedStackCount,
  });
}

function _canApplyStatusEffect(
  champion,
  statusEffectKey,
  duration,
  metadata,
  context,
) {
  if (context?.shieldBlockedTargets?.has(champion.id)) {
    return { allowed: false, reason: "shield-blocked" };
  }

  const definition = StatusEffectsRegistry[statusEffectKey];

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
  return champion.statusEffects.has(statusEffectName);
}

/**
 * Get statusEffect data
 * @param {object} champion - The champion instance
 * @param {string} name - Name of the statusEffect
 * @returns {object|null}
 */
export function getStatusEffectData(champion, name) {
  return champion.statusEffects.get(name) || null;
}

/**
 * Get statusEffect data
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect
 * @returns {object|null}
 */
export function getStatusEffect(champion, statusEffectName) {
  return champion.statusEffects.get(statusEffectName) || null;
}

/**
 * Get all active statusEffects for a champion, optionally filtered.
 * @param {object} champion - The champion instance
 * @param {object} options - Optional filters
 * @param {string|string[]} options.type - Return only status effects matching one or more types
 * @param {string|string[]} options.subtype - Return only status effects that include one or more subtypes
 * @param {function} options.predicate - Custom filter callback receiving each status effect instance
 * @returns {array}
 */
export function getStatusEffects(champion, options = {}) {
  if (!(champion?.statusEffects instanceof Map)) {
    return [];
  }

  const { type = null, subtype = null, predicate = null } = options;

  const typeFilters = (Array.isArray(type) ? type : type ? [type] : []).filter(
    Boolean,
  );
  const subtypeFilters = (
    Array.isArray(subtype) ? subtype : subtype ? [subtype] : []
  ).filter(Boolean);

  return Array.from(champion.statusEffects.values()).filter((statusEffect) => {
    if (!statusEffect || typeof statusEffect !== "object") {
      return false;
    }

    if (typeFilters.length > 0 && !typeFilters.includes(statusEffect.type)) {
      return false;
    }

    if (
      subtypeFilters.length > 0 &&
      !subtypeFilters.some((wantedSubtype) =>
        Array.isArray(statusEffect.subtypes)
          ? statusEffect.subtypes.includes(wantedSubtype)
          : false,
      )
    ) {
      return false;
    }

    if (typeof predicate === "function" && !predicate(statusEffect)) {
      return false;
    }

    return true;
  });
}

/**
 * Remove a statusEffect immediately
 * @param {object} champion - The champion instance
 * @param {string} statusEffectName - Name of the statusEffect to remove
 */
export function removeStatusEffect(champion, statusEffectName) {
  champion.statusEffects.delete(statusEffectName);
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
