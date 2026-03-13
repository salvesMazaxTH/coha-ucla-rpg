const tributoDeSangue = {
  key: "tributo",
  name: "Tributo de Sangue",
  type: "debuff",
  subtypes: ["damageAmplify", "healOnHit"],

  hookScope: {
    onBeforeDmgTaking: "target",
    onAfterDmgTaking: "target",
  },

  onBeforeDmgTaking({ source, target, damage, owner }) {
    // owner = alvo com tributo
    if (target !== owner) return;
    if (!source) return;
    if (damage <= 0) return;

    const bonus = 10;

    return {
      damage: damage + bonus,
      log: `🩸 Tributo amplificou o golpe de ${source.name} (+${bonus} dano)`
    };
  },

  onAfterDmgTaking({ source, target, owner, context }) {
    if (target !== owner) return;
    if (!source) return;

    const heal = 15;

    source.heal(heal, context);

    return {
      log: `🩸 Tributo: ${source.name} recuperou ${heal} HP.`
    };
  }
};

export default tributoDeSangue;