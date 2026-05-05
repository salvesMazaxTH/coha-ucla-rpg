import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

function normalizeStackCount(stackCount) {
  return Math.max(1, Math.floor(Number(stackCount) || 1));
}

function syncStackState(effect, stackCount, metadata = {}) {
  const normalizedStacks = Math.max(0, Math.floor(Number(stackCount) || 0));

  effect.stacks = normalizedStacks;
  effect.stackCount = normalizedStacks;
  effect.metadata = {
    ...(effect.metadata || {}),
    ...metadata,
    stacks: normalizedStacks,
    stackCount: normalizedStacks,
  };

  return normalizedStacks;
}

export function createStackBoundDotStatusEffect({
  key,
  name,
  logName = name,
  immuneLabel = logName,
  type = "debuff",
  subtypes = ["dot"],
  damageType,
  tickKey = `${key}_tick`,
  damagePerStackPercent = 0.05,
  formatOwnerName = true,
}) {
  return {
    key,
    name,
    type,
    subtypes,
    isStackable: true,
    durationFromStacks: true,

    onTurnStart({ owner, context }) {
      const currentStacks = normalizeStackCount(this.stacks);
      const damagePerStack = Math.floor(owner.maxHP * damagePerStackPercent);
      const totalDamage = damagePerStack * currentStacks;

      context.isDot = true;

      const dmgEvent = new DamageEvent({
        attacker: null,
        defender: owner,
        skill: { name: logName, key: tickKey },
        context,
        type: damageType,
        baseDamage: totalDamage,
        mode: DamageEvent.Modes.ABSOLUTE,
        allChampions: context.allChampions,
      });

      const result = dmgEvent.execute();
      const nextStacks = syncStackState(this, currentStacks - 1);

      if (nextStacks === 0) {
        this.expiresAtTurn = context.currentTurn;
      }

      const ownerLabel = formatOwnerName
        ? formatChampionName(owner)
        : owner.name;

      if (result?.immune) {
        return {
          log: `${ownerLabel} é imune ao dano de ${immuneLabel}!`,
        };
      }

      return {
        log: `${ownerLabel} sofre ${result?.totalDamage ?? totalDamage} de dano de <b>${logName}</b> (${currentStacks}x).`,
      };
    },

    reapplyInstance({ existingInstance, context, metadata, stackCount }) {
      const nextStacks =
        normalizeStackCount(existingInstance.stacks) +
        normalizeStackCount(stackCount);

      syncStackState(existingInstance, nextStacks, metadata);
      existingInstance.appliedAtTurn = context?.currentTurn ?? 0;
      existingInstance.expiresAtTurn =
        existingInstance.appliedAtTurn + nextStacks;

      return existingInstance;
    },

    createInstance({ owner, duration, context, metadata }) {
      const stacks = normalizeStackCount(metadata?.stackCount);

      return new StatusEffect({
        key: this.key,
        duration: Number.isFinite(duration) ? duration : stacks,
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
}