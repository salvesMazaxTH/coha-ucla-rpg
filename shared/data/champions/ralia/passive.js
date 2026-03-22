export default {
  name: "Desacreditar",
  critReduction: 45,
  description() {
    return `🧿 PASSIVA — Desacreditar
      Sempre que Rália sofrer um Acerto Crítico, o crítico é anulado completamente.`;
  },

  hookScope: {
    onBeforeDmgTaking: "target",
  },

  onBeforeDmgTaking({ source, target, owner, crit, context, damage }) {
    /* console.log(
      `[PASSIVA RÁLIA] Entrou | Crit=${crit.didCrit} | Bônus atual=${crit.bonus}% | Atacante=${source.name}`,
    );
    */

    if (!crit.didCrit) return;

    return {
      damage: damage - (crit.critExtra ?? 0),
      crit: {
        ...crit,
        didCrit: false,
        critExtra: 0,
      },
    };
  },
};
