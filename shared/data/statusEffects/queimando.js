import { DamageEvent } from "../../engine/combat/DamageEvent.js";

const queimando = {
  key: "queimando",
  name: "Queimando",
  type: "debuff",
  subtypes: ["dot", "fire"],

  onTurnStart({ owner, context }) {
    const damage = 15 + Math.floor(owner.maxHP * 0.04); // dano base + 4% do HP máximo

    context.isDot = true;

    const dmgEvent = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Queimadura", key: "queimando" },
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
};

export default queimando;
