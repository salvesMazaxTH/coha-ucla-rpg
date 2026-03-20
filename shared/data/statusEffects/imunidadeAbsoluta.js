import { formatChampionName } from "../../ui/formatters.js";

const imunidadeAbsoluta = {
  key: "imunidadeAbsoluta",
  name: "Imunidade Absoluta",
  type: "buff",
  subtypes: ["immunity"],

  hookScope: {
    onDamageIncoming: "target",
    onStatusEffectIncoming: "target",
  },

  onDamageIncoming({ target }) {
    return {
      cancel: true,
      immune: true,
      message: `${formatChampionName(target)} está com <b>${this.name}</b> e é imune a dano!`,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;

    return {
      cancel: true,
      message: `${formatChampionName(target)} está com <b>${this.name}</b> e é imune a efeitos negativos!`,
    };
  },
};

export default imunidadeAbsoluta;
