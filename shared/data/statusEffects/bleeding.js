import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

const bleeding = {
  key: "bleeding",
  name: "Sangramento",
  type: "debuff",
  subtypes: ["dot", "physical"],
  isStackable: true,
  durationFromStacks: true,

  onTurnStart({ owner, context }) {
    const stacks = this.stacks;
    const dmgPerStack = Math.floor(owner.maxHP * 0.05);
    context.isDot = true;

    const result = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Sangramento", key: "bleeding_tick" },
      context,
      type: "physical",
      baseDamage: dmgPerStack * stacks,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    }).execute();

    const next = stacks - 1;
    this.stacks = next;
    this.stackCount = next;
    if (next === 0) this.expiresAtTurn = context.currentTurn;

    const label = formatChampionName(owner);
    if (result?.immune)
      return { log: `${label} é imune ao dano de Sangramento!` };
    return {
      log: `${label} sofre ${result?.totalDamage ?? dmgPerStack * stacks} de dano de <b>Sangramento</b> (${stacks}x).`,
    };
  },

  createInstance({ owner, duration, context, metadata }) {
    const stacks = duration;
    return new StatusEffect({
      key: this.key,
      duration: stacks,
      owner,
      context,
      metadata: { ...metadata, stacks, stackCount: stacks },
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
        isStackable: this.isStackable,
        stacks,
        stackCount: stacks,
        onTurnStart: this.onTurnStart,
      },
    });
  },
};

export default bleeding;
