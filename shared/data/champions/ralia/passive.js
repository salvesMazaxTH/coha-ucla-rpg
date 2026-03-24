export default {
  name: "Desacreditar",
  critReduction: 45,
  description() {
    return `🧿 PASSIVA — Desacreditar
      Sempre que Rália sofrer um Acerto Crítico, o crítico é anulado completamente.`;
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
