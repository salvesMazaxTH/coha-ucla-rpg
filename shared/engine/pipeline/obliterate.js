export function processObliterate(event) {
  console.log("🔥 _processObliterateIfNeeded chamado:", {
    target: event.target.name,
    hp: event.target.HP,
    maxHP: event.target.maxHP,
  });
  const rule = event.skill?.obliterateRule;
  if (!rule) return;

  // caso já esteja morto
  if (event.target.alive === false) return;

  // aliados não se executam
  if (event.target.team === event.attacker.team) return;

  if (event.target.runtime?.preventObliterate) {
    console.log("[OBLITERATE] Cancelado por efeito de sobrevivência");
    return;
  }

  let threshold = rule(event);

  const override = event.context?.editMode?.executionOverride;

  if (typeof override === "number") {
    threshold = override;
  }

  const hpPercent = event.target.HP / event.target.maxHP;

  if (hpPercent <= threshold && event.target.HP > 0) {
    const dmg = event.target.HP;

    event.target.HP = 0;
    event.target.alive = false;

    event.context.registerDamage({
      target: event.target,
      amount: dmg,
      sourceId: event.attacker?.id,
      flags: { isObliterate: true },
    });
  }
}
