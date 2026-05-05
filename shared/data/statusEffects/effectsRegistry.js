import paralyzed from "./paralyzed.js";
import stunned from "./stunned.js";
import rooted from "./rooted.js";
import inert from "./inert.js";
import chilled from "./chilled.js";
import frozen from "./frozen.js";
import burning from "./burning.js";
import absoluteImmunity from "./absoluteImmunity.js";
import conductor from "./conductor.js";
import invisible from "./invisible.js";

import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

// Factory for DOT status effects where stacks ARE the duration:
// each tick consumes one stack; the effect ends when stacks reach zero.
function createStackBoundDot({
  key,
  name,
  logName = name,
  immuneLabel = logName,
  type = "debuff",
  subtypes = ["dot"],
  damageType,
  tickKey = `${key}_tick`,
  damagePerStackPercent = 0.05,
  useFormatName = true,
}) {
  return {
    key,
    name,
    type,
    subtypes,
    isStackable: true,
    durationFromStacks: true,

    onTurnStart({ owner, context }) {
      const stacks = this.stacks;
      const dmgPerStack = Math.floor(owner.maxHP * damagePerStackPercent);
      context.isDot = true;

      const result = new DamageEvent({
        attacker: null,
        defender: owner,
        skill: { name: logName, key: tickKey },
        context,
        type: damageType,
        baseDamage: dmgPerStack * stacks,
        mode: DamageEvent.Modes.ABSOLUTE,
        allChampions: context.allChampions,
      }).execute();

      const next = stacks - 1;
      this.stacks = next;
      this.stackCount = next;
      if (next === 0) this.expiresAtTurn = context.currentTurn;

      const label = useFormatName ? formatChampionName(owner) : owner.name;
      if (result?.immune) return { log: `${label} é imune ao dano de ${immuneLabel}!` };
      return {
        log: `${label} sofre ${result?.totalDamage ?? dmgPerStack * stacks} de dano de <b>${logName}</b> (${stacks}x).`,
      };
    },

    reapplyInstance({ existingInstance, context, stackCount }) {
      const next = existingInstance.stacks + stackCount;
      existingInstance.stacks = next;
      existingInstance.stackCount = next;
      existingInstance.appliedAtTurn = context?.currentTurn ?? 0;
      existingInstance.expiresAtTurn = existingInstance.appliedAtTurn + next;
      return existingInstance;
    },

    createInstance({ owner, duration, context, metadata }) {
      // duration == stackCount here: applyStatusEffect sets duration = stackCount for durationFromStacks effects
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
}

const bleeding = createStackBoundDot({
  key: "bleeding",
  name: "Sangramento",
  damageType: "physical",
  tickKey: "bleeding_tick",
  subtypes: ["dot", "physical"],
});

const poisoned = createStackBoundDot({
  key: "poisoned",
  name: "Envenenado",
  logName: "Envenenamento",
  immuneLabel: "Envenenamento",
  damageType: "magical",
  tickKey: "poisoned_tick",
  subtypes: ["dot", "magical"],
  useFormatName: false,
});

export const StatusEffectsRegistry = {
  paralyzed,
  stunned,
  rooted,
  inert,
  chilled,
  frozen,
  burning,
  bleeding,
  absoluteImmunity,
  conductor,
  invisible,
  poisoned,
};
