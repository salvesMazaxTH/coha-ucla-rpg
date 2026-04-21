import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const burning = {
  key: "burning",
  name: "Queimando",
  type: "debuff",
  subtypes: ["dot", "fire"],

  onTurnStart({ owner, context }) {
    const damage = 15 + Math.floor(owner.maxHP * 0.04); // dano base + 4% do HP máximo

    context.isDot = true;

    const dmgEvent = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Queimadura", key: "burning_tick" },
      context,
      baseDamage: damage,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    });

    const result = dmgEvent.execute();

    if (result?.immune) {
      return { log: `${owner.name} é imune ao dano de Queimadura!` };
    }

    return {
      log: `${owner.name} sofre ${result?.totalDamage ?? damage} de dano de Queimadura.`,
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
        onTurnStart: this.onTurnStart,
      },
    });
  },
};

export default burning;
