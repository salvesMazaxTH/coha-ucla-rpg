import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const bleeding = {
  key: "bleeding",
  name: "Sangramento",
  type: "debuff",
  subtypes: ["dot", "physical"],
  isStackable: true,
  defaultDuration: 2,

  onTurnStart({ owner, context }) {
    const stacks = Math.max(1, Number(this.stacks) || 1);
    const damagePerStack = Math.floor(owner.maxHP * 0.05); // 5% do HP máximo por stack
    const totalDamage = damagePerStack * stacks;

    context.isDot = true;

    const dmgEvent = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Sangramento", key: "bleeding_tick" },
      context,
      baseDamage: totalDamage,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    });

    const result = dmgEvent.execute();

    if (result?.immune) {
      return { log: `${owner.name} é imune ao dano de Sangramento!` };
    }

    return {
      log: `${owner.name} sofre ${result?.totalDamage ?? totalDamage} de dano de Sangramento (${stacks}x).`,
    };
  },

  reapplyInstance({
    existingInstance,
    duration,
    context,
    metadata,
    stackCount,
  }) {
    const nextStacks = Math.max(
      1,
      (Number(existingInstance.stacks) || 1) + Math.max(1, stackCount),
    );

    existingInstance.stacks = nextStacks;
    existingInstance.appliedAtTurn = context?.currentTurn ?? 0;
    existingInstance.expiresAtTurn =
      duration === Infinity
        ? Infinity
        : existingInstance.appliedAtTurn + duration;
    existingInstance.metadata = {
      ...(existingInstance.metadata || {}),
      ...metadata,
      stacks: nextStacks,
      stackCount: nextStacks,
    };
    existingInstance.stackCount = nextStacks;

    return existingInstance;
  },

  createInstance({ owner, duration, context, metadata }) {
    const stacks = Math.max(1, Number(metadata?.stackCount) || 1);

    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata: {
        ...metadata,
        stacks,
        stackCount: stacks,
      },
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
