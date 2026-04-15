import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const invisivel = {
  key: "invisivel",
  name: "Invisível",
  type: "buff",
  subtypes: ["stealth"],

  description: "Não pode ser alvo de inimigos até sua próxima ação.",

  hookScope: {
    onValidateAction: "target",
  },

  // 🔒 bloqueia ser alvo
  onValidateAction({ actionSource, owner, context }) {
    if (!actionSource || actionSource.id === owner.id) return;

    const message = `${formatChampionName(actionSource)} não consegue encontrar ${formatChampionName(owner)}.`;

    context?.registerDialog?.({
      message,
      sourceId: actionSource.id,
      targetId: owner.id,
    });

    return {
      deny: true,
      message,
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
        description: this.description,
        hookScope: this.hookScope,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default invisivel;
