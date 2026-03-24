import { formatChampionName } from "../../ui/formatters.js";

const enraizado = {
  key: "enraizado",
  name: "Enraizado",
  type: "debuff",
  subtypes: ["softCC"],

  hookScope: {
    onValidateAction: "actionSource",
  },

  onValidateAction({ actionSource, skill }) {
    if (!skill?.contact) return;

    const skillName = skill?.name || "habilidade";

    return {
      deny: true,
      message: `${formatChampionName(actionSource)} está Enraizado e não pode usar a habilidade de contato "${skillName}"!`,
    };
  },
};

export default enraizado;
