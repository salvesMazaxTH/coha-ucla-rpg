const tributoDeSangue = {
  key: "tributo",
  name: "Tributo de Sangue",
  type: "debuff",
  subtypes: ["damageAmplify", "healOnHit"],

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  onBeforeDmgTaking({ attacker, defender, damage, owner }) {
    // owner = alvo com tributo
    if (defender !== owner) return;
    if (!attacker) return;
    if (damage <= 0) return;

    const bonus = 10;

    return {
      damage: damage + bonus,
      log: `🩸 Tributo amplificou o golpe de ${attacker.name} (+${bonus} dano)`,
    };
  },

  onAfterDmgTaking({ attacker, defender, owner, context }) {
    if (defender !== owner) return;
    if (!attacker) return;

    const heal = 15;

    attacker.heal(heal, context);

    return {
      log: `🩸 Tributo: ${attacker.name} recuperou ${heal} HP.`,
    };
  },
};

export default tributoDeSangue;
