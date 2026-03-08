const inerte = {
  key: "inerte",
  name: "Inerte",
  type: "debuff",
  subtypes: ["cc", "hardCC"],

  onValidateAction({ user }) {
    const k = user.getStatusEffect("inerte");

    let deny = true;

    if (k?.canBeInterruptedByAction) {
      user.removeStatusEffect("inerte");
      deny = false;
      return {
        message: `O efeito "Inerte" de ${user.name} foi interrompido!`,
      };
    }

    return {
      deny,
      message: `${user.name} está Inerte e não pode agir!`,
    };
  },
};

export default inerte;
