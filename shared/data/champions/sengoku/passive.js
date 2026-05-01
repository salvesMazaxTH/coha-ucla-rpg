import { formatChampionName } from "../../../ui/formatters.js";

function roundToFive(x) {
  return Math.round(x / 5) * 5;
}

export default {
  key: "peso_dos_seculos",
  name: "Peso dos Séculos",
  attackReductionPercent: 18,
  defenseReductionPercent: 13.5,
  maxTriggers: 4,
  description() {
    return `Sengoku inicia o combate com atributos muito acima do normal, mas não consegue sustentar esse poder por muito tempo. No início de cada turno, perde ${this.attackReductionPercent}% do valor atual de seu Ataque e ${this.defenseReductionPercent}% da sua Defesa, no máximo ${this.maxTriggers} vezes por combate.`;
  },
  onTurnStart({ owner, context }) {
    owner.runtime ??= {};
    owner.runtime.pesoDosSeculosTriggers ??= 0;

    if (owner.runtime.pesoDosSeculosTriggers >= this.maxTriggers) {
      return;
    }

    owner.runtime.pesoDosSeculosTriggers += 1;

    // Reduz o valor ATUAL de Attack e Defense até o limite de ativações
    const attackReduction = roundToFive(
      Math.floor(owner.Attack * (this.attackReductionPercent / 100)),
    );

    const defenseReduction = roundToFive(
      Math.floor(owner.Defense * (this.defenseReductionPercent / 100)),
    );

    if (attackReduction > 0) {
      owner.Attack -= attackReduction;
    }
    if (defenseReduction > 0) {
      owner.Defense -= defenseReduction;
    }

    context.registerDialog({
      message: `[PASSIVA — Peso dos Séculos] ${formatChampionName(owner)} se enfraqueceu (perdeu Ataque e Defesa).`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `[PASSIVA — Peso dos Séculos] ${formatChampionName(owner)} perdeu ${attackReduction} de Ataque e ${defenseReduction} de Defesa (${owner.runtime.pesoDosSeculosTriggers}/${this.maxTriggers}).`,
    };
  },
};
