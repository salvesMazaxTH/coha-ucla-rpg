import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const imunidadeAbsoluta = {
  key: "imunidadeAbsoluta",
  name: "Imunidade Absoluta",
  type: "buff",
  subtypes: ["immunity"],

  hookScope: {
    onDamageIncoming: "defender",
    onStatusEffectIncoming: "target",
  },

  onDamageIncoming({ defender }) {
    return {
      cancel: true,
      immune: true,
      message: `${formatChampionName(defender)} está com <b>${this.name}</b> e é imune a dano!`,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;

    return {
      cancel: true,
      message: `${formatChampionName(target)} está com <b>${this.name}</b> e é imune a efeitos negativos!`,
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
        onDamageIncoming: this.onDamageIncoming,
        onStatusEffectIncoming: this.onStatusEffectIncoming,
      },
    });
  },
};

export default imunidadeAbsoluta;
