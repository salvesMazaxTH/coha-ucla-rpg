import { StatusEffect } from "../../core/StatusEffect.js";

const chilled = {
  key: "chilled",
  name: "Gelado",
  type: "debuff",
  subtypes: ["statMod", "ice"],

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Attack",
      amount: -20,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });

    owner.modifyStat({
      statName: "Speed",
      amount: -50,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
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
        onStatusEffectAdded: this.onStatusEffectAdded,
      },
    });
  },
};

export default chilled;
