import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "O Raio Pode Cair Duas Vezes",
  //1
  initialChance: 95, // PARA TESTAR
  chanceIncreasePerTurn: 5,
  description(champion) {
    return `As habilidades de dano Elias Cross têm <b>${champion.runtime.passiveChance ?? this.initialChance}%</b> de chance de se repetirem. A cada turno, ele ganha <b>+${this.chanceIncreasePerTurn}%</b> de chance. `;
  },

  hookScope: {
    onActionResolved: "source",
  },

  onActionResolved({ source, targets, owner, skill, context }) {
    console.log(
      `[PASSIVA - Elias Cross] chance atual de ativação é ${owner.runtime.passiveChance ?? this.initialChance}%`,
    );
    if (context.damageDepth > 0) return;

    owner.runtime.passiveChance ??= this.initialChance;
    console.log(
      `[PASSIVA - Elias Cross] chance atual de ativação é ${owner.runtime.passiveChance}%`,
    );

    const baseChance = owner.runtime.passiveChance ?? this.initialChance;
    const bonus = owner.runtime.passiveBonusNextTurn ?? 0;

    const chance = Math.min(100, baseChance + bonus) / 100;

    const roll = Math.random();
    console.log(
      `[PASSIVA - Elias Cross] Rolagem: ${roll}, Chance de ativação: ${chance}`,
    );

    if (roll < chance) {
      console.log(`[PASSIVA - Elias Cross] Passiva ativada!`);

      context.registerDialog({
        message: `<b>[Passiva – "${this.name}"]</b>`,
        sourceId: owner.id,
        blocking: true,
      });

      context.damageDepth = 1;

      skill.resolve({
        user: owner,
        targets,
        context,
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
