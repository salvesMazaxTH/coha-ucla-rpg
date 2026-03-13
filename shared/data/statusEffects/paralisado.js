const paralisado = {
  key: "paralisado",
  name: "Paralisado",
  type: "debuff",
  subtypes: ["softCC"],

  hookScope: {
    onValidateAction: "owner",
  },

  onValidateAction({ source }) {
    const chanceOfActing = 0.5; // 50% de chance de agir normalmente
    const roll = Math.random();
    if (!(roll < chanceOfActing)) {
      return {
        deny: true,
        message: `${source.name} está Paralisado e não pode agir!`,
      };
    }
  },
};

export default paralisado;
