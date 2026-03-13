// Reduz velocidade e ataque a 0 e impede de agir por X turno(s) (X geralmente 1)
const congelado = {
  key: "congelado",
  name: "Congelado",
  type: "debuff",
  subtypes: ["cc", "hardCC"],

  onStatusEffectAdded({ owner }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration: 1,
      isPercent: true,
    });
    owner.modifyStat({
      statName: "Attack",
      amount: -100,
      duration: 1,
      isPercent: true,
    });
    return {
      message: `${owner.name} foi Congelado!`,
    };
  },

  hookScope: {
    onValidateAction: "owner",
  },

  onValidateAction({ source }) {
    return {
      deny: true,
      message: `${source.name} está Congelado e não pode agir!`,
    };
  },
};

export default congelado;
