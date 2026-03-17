import { formatChampionName } from "../../ui/formatters.js";

const inerte = {
  key: "inerte",
  name: "Inerte",
  type: "debuff",
  subtypes: ["hardCC"],

  hookScope: {
    onValidateAction: "source",
  },

  onValidateAction({ source }) {
    const k = source.getStatusEffect("inerte");

    let deny = true;

    if (k?.canBeInterruptedByAction) {
      source.removeStatusEffect("inerte");
      deny = false;
      return {
        message: `O efeito "Inerte" de ${formatChampionName(source)} foi interrompido!`,
      };
    }

    return {
      deny,
      message: `${formatChampionName(source)} está Inerte e não pode agir!`,
    };
  },
};

export default inerte;
