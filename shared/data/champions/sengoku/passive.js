import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "peso_dos_seculos",
  name: "Peso dos Séculos",
  attackReductionPercent: 17,
  defenseReductionPercent: 13.5,
  maxTriggers: 4,
  description() {
    return `Sengoku inicia o combate com atributos muito acima do normal, mas não consegue sustentar esse poder por muito tempo. No início de cada turno, perde ${this.attackReductionPercent}% do seu Ataque base e ${this.defenseReductionPercent}% da sua Defesa base, no máximo ${this.maxTriggers} vezes por combate.`;
  },
  onTurnStart({ owner, context }) {
    owner.runtime ??= {};
    owner.runtime.pesoDosSeculosTriggers ??= 0;

    if (owner.runtime.pesoDosSeculosTriggers >= this.maxTriggers) {
      return;
    }

    owner.runtime.pesoDosSeculosTriggers += 1;

    const attackResult = owner.modifyStat({
      statName: "Attack",
      amount: -this.attackReductionPercent,
      context,
      isPermanent: true,
      isPercent: true,
      statModifierSrc: owner,
    });

    const defenseResult = owner.modifyStat({
      statName: "Defense",
      amount: -this.defenseReductionPercent,
      context,
      isPermanent: true,
      isPercent: true,
      statModifierSrc: owner,
    });

    const attackLoss = Math.abs(attackResult?.appliedAmount ?? 0);
    const defenseLoss = Math.abs(defenseResult?.appliedAmount ?? 0);

    context.registerDialog({
      message: `[PASSIVA — Peso dos Séculos] ${formatChampionName(owner)} se enfraqueceu (perdeu Ataque e Defesa).`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `[PASSIVA — Peso dos Séculos] ${formatChampionName(owner)} perdeu ${attackLoss} de Ataque e ${defenseLoss} de Defesa (${owner.runtime.pesoDosSeculosTriggers}/${this.maxTriggers}).`,
    };
  },
};
