import { formatChampionName } from "../../ui/formatters.js";

// Reduz velocidade e ataque a 0 e impede de agir por X turno(s) (X geralmente 1)
const congelado = {
  key: "congelado",
  name: "Congelado",
  type: "debuff",
  subtypes: ["hardCC", "ice"],

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
    owner.modifyStat({
      statName: "Attack",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
    return {
      message: `${owner.name} foi Congelado!`,
    };
  },

  hookScope: {
    onValidateAction: "actionSource",
    onAfterDmgTaking: "defender",
  },

  onValidateAction({ actionSource }) {
    return {
      deny: true,
      message: `${formatChampionName(actionSource)} está Congelado e não pode agir!`,
    };
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;
    defender.removeStatusEffect("congelado");

    return {
      log: `${formatChampionName(defender)} foi descongelado após receber dano!`,
    };
  },
};

export default congelado;
