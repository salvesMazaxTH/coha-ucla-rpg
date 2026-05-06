const DEFAULT_ELEMENTAL_STATUS_IMMUNITY_RULES = {
  steel: ["poisoned"],
};

export function resolveElementalStatusImmunity({
  target,
  statusEffect,
  rules = DEFAULT_ELEMENTAL_STATUS_IMMUNITY_RULES,
} = {}) {
  const affinities = target.elementalAffinities;
  const statusKey = statusEffect.key;
  const statusSubtypes = new Set(statusEffect.subtypes);

  if (affinities.some((affinity) => statusSubtypes.has(affinity))) {
    return {
      immunityType: "same-element",
    };
  }

  for (const affinity of affinities) {
    const immuneStatusKeys = rules[affinity];
    if (!immuneStatusKeys?.includes(statusKey)) continue;

    return {
      immunityType: "rule",
      affinity,
    };
  }

  return null;
}

export { DEFAULT_ELEMENTAL_STATUS_IMMUNITY_RULES };
