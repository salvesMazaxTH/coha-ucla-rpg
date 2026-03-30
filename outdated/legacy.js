/* function buildReactionEnvelopesFromContext({ user, skill, context }) {
  const {
    damageEvents = [],
    healEvents = [],
    shieldEvents = [],
    buffEvents = [],
    resourceEvents = [],
    dialogEvents = [],
  } = context.visual || {};

  const userId = user?.id ?? null;
  const userName = user?.name ?? null;

  const allDepths = new Set([
    ...damageEvents.map((e) => e.damageDepth ?? 0),
    ...healEvents.map((e) => e.damageDepth ?? 0),
    ...shieldEvents.map((e) => e.damageDepth ?? 0),
    ...buffEvents.map((e) => e.damageDepth ?? 0),
    ...resourceEvents.map((e) => e.damageDepth ?? 0),
    ...dialogEvents.map((e) => e.damageDepth ?? 0),
  ]);

  const reactionDepths = [...allDepths]
    .filter((depth) => depth > 0)
    .sort((a, b) => a - b);

  const envelopes = [];

  for (const depth of reactionDepths) {
    const damageForDepth = damageEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const healForDepth = healEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const shieldForDepth = shieldEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const buffForDepth = buffEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const resourceForDepth = resourceEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );
    const dialogForDepth = dialogEvents.filter(
      (e) => (e.damageDepth ?? 0) === depth,
    );

    const affectedForDepth = new Set(
      [
        ...damageForDepth,
        ...healForDepth,
        ...shieldForDepth,
        ...buffForDepth,
        ...resourceForDepth,
      ]
        .map((e) => e.targetId)
        .filter(Boolean),
    );

    const reactionTargetIds = [
      ...new Set(
        [...damageForDepth, ...healForDepth, ...shieldForDepth]
          .map((e) => e.targetId)
          .filter((id) => id && id !== userId),
      ),
    ];

    const { targetId, targetName } = buildEmitTargetInfo(reactionTargetIds);

    envelopes.push({
      action: {
        userId: damageForDepth[0]?.sourceId ?? userId,
        userName:
          match.combat.activeChampions.get(damageForDepth[0]?.sourceId)?.name ??
          userName,
        skillKey: `${skill.key}-reaction-${depth}`,
        skillName: `${skill.name} (Reação ${depth})`,
        targetId,
        targetName,
      },
      damageEvents: damageForDepth,
      healEvents: healForDepth,
      shieldEvents: shieldForDepth,
      buffEvents: buffForDepth,
      resourceEvents: resourceForDepth,
      dialogEvents: dialogForDepth,
      state: snapshotChampions([...affectedForDepth]),
    });
  }

  return envelopes;
} */