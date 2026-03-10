const gelado = {
  key: "gelado",
  name: "Gelado",
  type: "debuff",
  subtypes: ["statMod"],

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Attack",
      amount: -20,
      duration,
      context,
      isPercent: true,
    });

    owner.modifyStat({
      statName: "Speed",
      amount: -50,
      duration,
      context,
      isPercent: true,
    });
  },
};

export default gelado;
