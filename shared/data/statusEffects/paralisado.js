import { formatChampionName } from "../../ui/formatters.js";

const paralisado = {
  key: "paralisado",
  name: "Paralisado",
  type: "debuff",
  subtypes: ["softCC", "statMod", "lightning"],

  hookScope: {
    onValidateAction: "source",
  },

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
    return {
      message: `${formatChampionName(owner)} foi Paralisado! Velocidade reduzida, mas com chance de não agir!`,
    };
  },

  onValidateAction({ source }) {
    const chanceOfActing = 0.9; // 0.5 // TESTE // TESTE // 50% de chance de agir normalmente
    const roll = Math.random();
    console.log(
      `[PARALISADO] Rolando para ação de ${formatChampionName(source)} (Paralisado): ${roll.toFixed(2)} vs ${chanceOfActing}. Conseguiu agir? ${roll < chanceOfActing ? "Sim" : "Não"}`,
    );
    if (roll >= chanceOfActing) {
      return {
        deny: true,
        message: `${formatChampionName(source)} está Paralisado e não pode agir!`,
      };
    }
  },
};

export default paralisado;
