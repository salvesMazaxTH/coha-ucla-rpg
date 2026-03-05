import { formatChampionName } from "../../ui/formatters.js";

export default {
  name: "O Raio Pode Cair Duas Vezes",
  initialChance: 1,
  chanceIncreasePerTurn: 5,
  description(champion) {
    return `As habilidades de dano Elias Cross têm <b>${champion.runtime.passiveChance ?? this.initialChance}%</b> de chance de se repetirem. A cada turno, ele ganha <b>+${this.chanceIncreasePerTurn}%</b> de chance. `;
  },

  hookScope: {
    onAfterDmgDealing: "source",
  },

  onAfterDmgDealing({
    dmgSrc,
    dmgReceiver,
    owner,
    target,
    skill,
    damage,
    context,
  }) {
    if (context.damageDepth > 0) return;

    owner.runtime.passiveChance ??= this.initialChance;

    const baseChance = owner.runtime.passiveChance ?? this.initialChance;
    const bonus = owner.runtime.passiveBonusNextTurn ?? 0;

    const chance = Math.min(100, baseChance + bonus) / 100;

    const roll = Math.random();

    if (roll < chance) {
      context.extraDamageQueue ??= [];

      context.extraDamageQueue.push({
        mode: "standard",
        baseDamage: skill.baseDamage,
        user: owner,
        target: dmgReceiver,
        skill,
      });
    }
  },

  onTurnStart({ owner }) {
    owner.runtime.passiveChance = Math.min(
      100,
      (owner.runtime.passiveChance || this.initialChance) +
        this.chanceIncreasePerTurn,
    );

    // Limpa o bônus de chance do próximo turno, se houver
    owner.runtime.passiveBonusNextTurn = 0;
  },
};
