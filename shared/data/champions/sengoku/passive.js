import { formatChampionName } from "../../../ui/formatters.js";

function roundToFive(x) {
  return Math.round(x / 5) * 5;
}

export default {
  key: "peso_dos_seculos",
  name: "Peso dos Séculos",
  reductionPercent: 30,
  description() {
    return `No início de cada turno, Sengoku perde ${this.reductionPercent}% do valor atual de seu Ataque e Defesa (aplicação composta, não cumulativa sobre o valor base).`;
  },
  onTurnStart({ owner, context }) {
    // Reduz 30% do valor ATUAL de Attack e Defense a cada turno
    const attackReduction = roundToFive(
      Math.floor(owner.Attack * (this.reductionPercent / 100)),
    );

    const defenseReduction = roundToFive(
      Math.floor(owner.Defense * (this.reductionPercent / 100)),
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
      log: `[PASSIVA — Peso dos Séculos] ${formatChampionName(owner)} perdeu ${attackReduction} de Ataque e ${defenseReduction} de Defesa.`,
    };
  },
};
