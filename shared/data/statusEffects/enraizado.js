import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

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

  createInstance({ owner, duration, context, metadata }) {
    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
        hookScope: this.hookScope,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default enraizado;
