import { formatChampionName } from "../../ui/formatters.js";

const atordoado = {
  key: "atordoado",
  name: "Atordoado",
  type: "debuff",
  subtypes: ["hardCC"],

  hookScope: {
    onValidateAction: "actionSource",
  },

  onValidateAction({ actionSource }) {
    return {
      deny: true,
      message: `${formatChampionName(actionSource)} está Atordoado e não pode agir!`,
    };
  },
};

export default atordoado;
