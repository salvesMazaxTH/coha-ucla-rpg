import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const paralisado = {
  key: "paralisado",
  name: "Paralisado",
  type: "debuff",
  subtypes: ["softCC", "statMod", "lightning"],

  hookScope: {
    onValidateAction: "actionSource",
  },

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
    return {
      message: `${formatChampionName(owner)} foi Paralisado! Velocidade reduzida, mas com chance de não agir!`,
    };
  },

  onValidateAction({ actionSource }) {
    const chanceOfActing = 0.6; // 60% de chance de agir normalmente
    const roll = Math.random();
    console.log(
      `[PARALISADO] Rolando para ação de ${formatChampionName(actionSource)} (Paralisado): ${roll.toFixed(2)} vs ${chanceOfActing}. Conseguiu agir? ${roll < chanceOfActing ? "Sim" : "Não"}`,
    );
    if (roll >= chanceOfActing) {
      return {
        deny: true,
        message: `${formatChampionName(actionSource)} está Paralisado e não pode agir!`,
      };
    }
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
        onStatusEffectAdded: this.onStatusEffectAdded,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default paralisado;
