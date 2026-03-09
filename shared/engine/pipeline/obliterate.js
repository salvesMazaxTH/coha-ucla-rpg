export function processObliterate(event) {
  console.log("🔥 _processObliterateIfNeeded chamado:", {
    defender: event.defender.name,
    hp: event.defender.HP,
    maxHP: event.defender.maxHP,
  });
  const rule = event.skill?.obliterateRule;
  if (!rule) return;

  // caso já esteja morto
  if (event.defender.alive === false) return;

  // aliados não se executam
  if (event.defender.team === event.attacker.team) return;

  if (event.defender.runtime?.preventObliterate) {
    console.log("[OBLITERATE] Cancelado por efeito de sobrevivência");
    return;
  }

  let threshold = rule(event);

  const override = event.context?.editMode?.executionOverride;

  if (typeof override === "number") {
    threshold = override;
  }

  const hpPercent = event.defender.HP / event.defender.maxHP;

  if (hpPercent <= threshold && event.defender.HP > 0) {
    const dmg = event.defender.HP;

    event.defender.HP = 0;
    event.defender.alive = false;

    event.context.registerDamage({
      target: event.defender,
      amount: dmg,
      sourceId: event.attacker?.id,
      flags: { isObliterate: true },
    });
  }
}
