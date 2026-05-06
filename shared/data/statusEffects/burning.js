import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

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
      type: "magical",
      baseDamage: damage,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    });

    const result = dmgEvent.execute();

    if (result?.immune) {
      return { log: `${formatChampionName(owner)} é imune ao dano de <b>Queimadura</b>!` };
    }

    return {
      log: `${formatChampionName(owner)} sofre ${result?.totalDamage ?? damage} de dano de <b>Queimadura</b>.`,
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
