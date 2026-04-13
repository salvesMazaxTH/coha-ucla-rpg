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

  onBeforeDmgTaking({ crit }) {
    if (!crit.didCrit) return;

    return {
      crit: {
        ...crit,
        didCrit: false,
        bonus: 0,
        forced: false,
        critExtra: 0,
      },
    };
  },
};
