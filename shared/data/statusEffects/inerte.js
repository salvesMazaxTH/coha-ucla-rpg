import { formatChampionName } from "../../ui/formatters.js";

const inerte = {
  key: "inerte",
  name: "Inerte",
  type: "debuff",
  subtypes: ["hardCC"],

  hookScope: {
    onValidateAction: "actionSource",
  },

  onValidateAction({ actionSource }) {
    const k = actionSource.getStatusEffect("inerte");

    let deny = true;

    if (k?.canBeInterruptedByAction) {
      actionSource.removeStatusEffect("inerte");
      deny = false;
      return {
        message: `O efeito "Inerte" de ${formatChampionName(actionSource)} foi interrompido!`,
      };
    }

    return {
      deny,
      message: `${formatChampionName(actionSource)} está Inerte e não pode agir!`,
    };
  },
};

export default inerte;
