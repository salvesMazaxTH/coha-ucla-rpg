import { StatusEffect } from "../../core/StatusEffect.js";

const conductor = {
  key: "conductor",
  name: "Condutor",
  type: "debuff",
  subtypes: ["damageMod", "lightning"],

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking({ defender, damage, context, skill }) {
    if (skill.element !== "lightning") return;

    damage = Math.round(damage * 1.2);

    return { damage };
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
        onBeforeDmgTaking: this.onBeforeDmgTaking,
      },
    });
  },
};

export default conductor;
