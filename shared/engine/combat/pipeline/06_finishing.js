export function processFinishing(event) {
  console.log("🔥 _processFinishingIfNeeded chamado:", {
    defender: event.defender.name,
    hp: event.defender.HP,
    maxHP: event.defender.maxHP,
  });

  const rule = event.skill?.finishingRule ?? event.skill?.obliterateRule;
  if (!rule) return;

  const finishingType = resolveFinishingType(event.skill);
  const finishingFlags = buildFinishingFlags(finishingType);

  // aliados não se executam
  if (event.defender.team === event.attacker.team) return;

  // finishing só faz sentido se o hit realmente conectou e causou dano
  if (!event.actualDmg || event.actualDmg <= 0) return;

  if (event.defender.runtime?.preventFinishing) {
    console.log("[FINISHING] Cancelado por efeito de sobrevivência");
    return;
  }

  let threshold =
    typeof rule === "function" ? rule.call(event.skill, event) : rule;

  const override = event.context?.editMode?.executionOverride;

  if (typeof override === "number") {
    threshold = override;
  }

  const hpAfter = Number.isFinite(event.hpAfter)
    ? event.hpAfter
    : event.defender.HP;
  const hpPercent = hpAfter / event.defender.maxHP;

  if (hpPercent <= threshold) {
    const remainingHp = Math.max(0, hpAfter);

    registerFinishingDialog(event, finishingType);

    event.defender.HP = 0;
    event.defender.alive = false;
    event.hpAfter = 0;

    event.context.registerDamage({
      target: event.defender,
      amount: remainingHp,
      sourceId: event.attacker?.id,
      flags: finishingFlags,
    });
  }
}

function resolveFinishingType(skill) {
  const skillType =
    typeof skill?.finishingType === "function"
      ? skill.finishingType()
      : skill?.finishingType;

  return skillType || (skill?.obliterateRule ? "obliterate" : "regular");
}

function buildFinishingFlags(finishingType) {
  return {
    finishing: true,
    finishingType,
  };
}

function registerFinishingDialog(event, finishingType) {
  const dialogFactory = event.skill?.finishingDialog;
  if (typeof dialogFactory !== "function") return;

  const message = dialogFactory({
    attacker: event.attacker,
    defender: event.defender,
    event,
    finishingType,
  });

  if (!message) return;

  event.context.registerDialog({
    message,
    sourceId: event.attacker?.id,
    targetId: event.defender?.id,
  });
}

export { processFinishing as processObliterate };
