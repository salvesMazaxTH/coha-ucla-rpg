import { formatChampionName } from "../../ui/formatters.js";

const enraizado = {
  key: "enraizado",
  name: "Enraizado",
  type: "debuff",
  subtypes: ["softCC"],

  hookScope: {
    onValidateAction: "source",
  },

  onValidateAction({ source, skill }) {
    if (!skill?.contact) return;

    const skillName = skill?.name || "habilidade";

    return {
      deny: true,
      message: `${formatChampionName(source)} está Enraizado e não pode usar a habilidade de contato "${skillName}"!`,
    };
  },
};

export default enraizado;
