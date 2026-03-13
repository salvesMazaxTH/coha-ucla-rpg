const inerte = {
  key: "inerte",
  name: "Inerte",
  type: "debuff",
  subtypes: ["hardCC"],

  hookScope: {
    onValidateAction: "owner",
  },

  onValidateAction({ source }) {
    const k = source.getStatusEffect("inerte");

    let deny = true;

    if (k?.canBeInterruptedByAction) {
      source.removeStatusEffect("inerte");
      deny = false;
      return {
        message: `O efeito "Inerte" de ${source.name} foi interrompido!`,
      };
    }

    return {
      deny,
      message: `${source.name} está Inerte e não pode agir!`,
    };
  },
};

export default inerte;
