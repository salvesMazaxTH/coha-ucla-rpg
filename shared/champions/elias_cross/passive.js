import { formatChampionName } from "../../core/formatters";

export default {
  name: "O Raio Pode Cair Duas Vezes",
  initialChance: 1,
  chanceIncreasePerTurn: 5,
  description() {
    return `As habilidades de ${formatChampionName("Elias Cross")} têm ${this.initialChance}% de chance de se repetirem. A cada turno, ele ganha +${this.chanceIncreasePerTurn}% de chance. `;
  },
  onAfterUsingDamageSkill({ skill, dmgSrc, owner, targets, context }) {
    if (owner?.id !== dmgSrc?.id) return;

    const chance = owner.runtime.passiveChance / 100;

    const roll = Math.random();

    if (roll < chance) {
      return skill.execute({ user: owner, targets, context });
    }
  },
  onTurnStart({ owner }) {
    if (owner.id !== this.ownerId) return;
    owner.runtime.passiveChance = Math.min(100, (owner.runtime.passiveChance || 0) + this.chanceIncreasePerTurn);
  },
};
