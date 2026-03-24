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
    return {
      deny: true,
      message: `${formatChampionName(actionSource)} está Inerte e não pode agir!`,
    };
  },
};

export default inerte;
