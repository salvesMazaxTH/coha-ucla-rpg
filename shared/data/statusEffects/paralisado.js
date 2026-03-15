const paralisado = {
  key: "paralisado",
  name: "Paralisado",
  type: "debuff",
  subtypes: ["softCC", "lightning"],

  hookScope: {
    onValidateAction: "source",
  },

  onValidateAction({ source }) {
    const chanceOfActing = 0.5; // 50% de chance de agir normalmente
    const roll = Math.random();
    console.log(
      `[PARALISADO] Rolando para ação de ${source.name} (Paralisado): ${roll.toFixed(2)} vs ${chanceOfActing}. Conseguiu agir? ${roll < chanceOfActing ? "Sim" : "Não"}`,
    );
    if (roll >= chanceOfActing) {
      return {
        deny: true,
        message: `${source.name} está Paralisado e não pode agir!`,
      };
    }
  },
};

export default paralisado;
