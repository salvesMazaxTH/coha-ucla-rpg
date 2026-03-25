export default {
  name: "Desacreditar",
  critReduction: 45,
  description() {
    return `
      Acertos Críticos contra Rália são anulados e causam dano normal.`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking({ attacker, defender, owner, crit, context, damage }) {
    if (!crit.didCrit) return;

    return {
      damage: damage / (1 + (crit.critBonusFactor ?? 0)),
      crit: {
        ...crit,
        didCrit: false,
        critExtra: 0,
      },
    };
  },
};
