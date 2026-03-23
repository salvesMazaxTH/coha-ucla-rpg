import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "O Raio Pode Cair Duas Vezes",
  initialChance: 1,
  chanceIncreasePerTurn: 5,
  description(champion) {
    return `As habilidades de dano Elias Cross têm <b>${champion.runtime.passiveChance ?? this.initialChance}%</b> de chance de se repetirem. A cada turno, ele ganha <b>+${this.chanceIncreasePerTurn}%</b> de chance. `;
  },

  hookScope: {
    onActionResolved: "source",
  },

  onActionResolved({ owner, skill, action, context }) {
    if (context?.isPassiveRepeat) return;

    const events = context?.visual?.damageEvents ?? [];

    const didDealMainDamage = events.some(
      (e) =>
        (e.damageDepth ?? 0) === 0 && e.sourceId === owner.id && e.amount > 0,
    );

    if (!didDealMainDamage) return;

    owner.runtime.passiveChance ??= this.initialChance;

    const chance = owner.runtime.passiveChance / 100;
    const roll = Math.random();

    console.log(`[PASSIVA - Elias] roll=${roll} | chance=${chance}`);

    if (roll >= chance) return;

    context.registerDialog({
      message: `<b>[Passiva – "${this.name}"]</b>`,
      sourceId: owner.id,
      blocking: true,
    });

    context.repeatActionRequest = {
      userId: owner.id,
      skillKey: skill?.key,
      targetIds: action?.targetIds ?? {},
      priority: skill?.priority ?? 0,
      speed: owner.Speed ?? 0,
    };
  },

  onTurnStart({ owner, context }) {
    owner.runtime.passiveChance ??= this.initialChance;

    const turn = context?.currentTurn ?? 0;
    const buffs = owner.runtime.passiveTempBuffs ?? [];

    let expired = 0;

    const activeBuffs = buffs.filter((b) => {
      const amount = b?.amount ?? 0;
      const expires = b?.expiresAtTurn;

      if (Number.isFinite(expires) && expires <= turn) {
        expired += amount;
        return false;
      }

      return true;
    });

    owner.runtime.passiveTempBuffs = activeBuffs;

    const next =
      owner.runtime.passiveChance - expired + this.chanceIncreasePerTurn;

    owner.runtime.passiveChance = Math.max(0, Math.min(100, next));
  },
};
