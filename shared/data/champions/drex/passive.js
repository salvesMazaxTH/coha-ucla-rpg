import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "sede_de_sangue",
  name: "Sede de Sangue",

  lifeStealPerProc: 3,

  description() {
    return `Ganha +${this.lifeStealPerProc}% de Roubo de Vida permanente sempre que um aliado aplica Sangramento ou sempre que um inimigo sofre dano de Sangramento.`;
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  onStatusEffectApplied({ source, statusEffectKey, owner, context }) {
    if (statusEffectKey !== "bleeding") return;
    if (!source || source.team !== owner.team) return;

    const result = owner.modifyStat({
      statName: "LifeSteal",
      amount: this.lifeStealPerProc,
      context,
      isPermanent: true,
      ignoreMinimum: true,
      statModifierSrc: source,
    });

    if (!result?.appliedAmount) return;

    return {
      log: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} se alimenta do Sangramento de ${formatChampionName(source)} (+${result.appliedAmount}% Roubo de Vida permanente).`,
    };
  },

  onAfterDmgTaking({ defender, skill, owner, context }) {
    if (!context?.isDot) return;
    if (skill?.key !== "bleeding_tick") return;
    if (!defender || defender.team === owner.team) return;

    const result = owner.modifyStat({
      statName: "LifeSteal",
      amount: this.lifeStealPerProc,
      context,
      isPermanent: true,
      ignoreMinimum: true,
      statModifierSrc: defender,
    });

    if (!result?.appliedAmount) return;

    return {
      log: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} absorve o Sangramento de ${formatChampionName(defender)} (+${result.appliedAmount}% Roubo de Vida permanente).`,
    };
  },
};
