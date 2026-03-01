import { formatChampionName } from "../../core/formatters";

export default {
    name: "O Raio Pode Cair Duas Vezes",
    initialChance: 1,
    chanceIncreasePerTurn: 5,
    description() {
        return `As habilidades de dano ${formatChampionName("Elias Cross")} têm ${this.initialChance}% de chance de se repetirem. A cada turno, ele ganha +${this.chanceIncreasePerTurn}% de chance. `;
    },
    onAfterDmgDealing({
        dmgSrc,
        dmgReceiver,
        owner,
        target,
        skill,
        damage,
        context
    }) {
        if (owner?.id !== dmgSrc?.id) return;

        if (context.damageDepth > 0) return;

        owner.runtime.passiveChance ??= this.initialChance;

        const chance = owner.runtime.passiveChance / 100;

        const roll = Math.random();

        if (roll < chance) {
            context.extraDamageQueue ??= [];

            context.extraDamageQueue.push({
                mode: "raw",
                baseDamage: skill.baseDamage,
                user: owner,
                target: dmgReceiver,
                skill
            });
        }
    },
    onTurnStart({ owner }) {
        //if (owner.id !== this.ownerId) return;
        owner.runtime.passiveChance = Math.min(
            100,
            (owner.runtime.passiveChance || 0) + this.chanceIncreasePerTurn
        );
    }
};
