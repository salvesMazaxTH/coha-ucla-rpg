const gelado = {
  key: "gelado",
  name: "Gelado",
  type: "debuff",
  subtypes: ["statMod"],

  onStatusEffectAdded({ self, duration, context }) {
    self.modifyStat({
      statName: "Attack",
      amount: -20,
      duration,
      context,
      isPercent: true,
    });

    self.modifyStat({
      statName: "Speed",
      amount: -50,
      duration,
      context,
      isPercent: true,
    });
  },
};

export default gelado;
