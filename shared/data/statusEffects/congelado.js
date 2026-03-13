// Reduz velocidade e ataque a 0 e impede de agir por X turno(s) (X geralmente 1)
const congelado = {
  key: "congelado",
  name: "Congelado",
  type: "debuff",
  subtypes: ["hardCC"],

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
    onAfterDmgTaking: "target",
  },

  onValidateAction({ source }) {
    return {
      deny: true,
      message: `${source.name} está Congelado e não pode agir!`,
    };
  },

  onAfterDmgTaking({ source, target, owner, damage, context }) {
    if (damage <= 0) return;
    owner.removeStatusEffect("congelado");

    return {
      log: `${owner.name} foi descongelado após receber dano!`,
    };
  },
};

export default congelado;
