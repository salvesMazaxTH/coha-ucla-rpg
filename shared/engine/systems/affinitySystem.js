const ELEMENT_CYCLE = ["fire", "ice", "earth", "lightning", "water"];

export function applyAffinity(event, debugMode) {
  const skillElement = event.skill?.element;

  if (!skillElement) return;
  if (!event.target?.elementalAffinities?.length) return;

  if (debugMode) {
    console.log("🔥 _applyAffinity chamado:", {
      skillElement,
      target: event.target.name,
      affinities: event.target.elementalAffinities,
      damage: event.damage,
    });
  }

  let strongestRelation = "neutral";

  for (const affinity of event.target.elementalAffinities) {
    const relation = _getElementalRelation(skillElement, affinity);

    if (relation === "weak") {
      event.damage = Math.floor(event.damage * 1.2 + 25);
      strongestRelation = "weak";
      break;
    }

    if (relation === "resist" && strongestRelation !== "weak") {
      event.damage = Math.max(event.damage - 40, 0);
      strongestRelation = "resist";
      break;
    }
  }

  if (strongestRelation !== "neutral") {
    const message =
      strongestRelation === "weak"
        ? "✨ É SUPER-EFETIVO!"
        : "🛡️ Não é muito efetivo...";

    event.context.visual.dialogEvents ??= [];
    event.context.visual.dialogEvents.push({
      type: "dialog",
      message,
      blocking: false,
    });
  }

  event.context.ignoreMinimumFloor = true;
}

function _getElementalRelation(attackingElement, defendingElement) {
  const cycle = ELEMENT_CYCLE;

  const index = cycle.indexOf(attackingElement);

  if (index === -1) return "neutral";

  const strongAgainst = cycle[(index + 1) % cycle.length];
  const weakAgainst = cycle[(index - 1 + cycle.length) % cycle.length];

  if (defendingElement === strongAgainst) return "weak";

  if (defendingElement === weakAgainst) return "resist";

  return "neutral";
}