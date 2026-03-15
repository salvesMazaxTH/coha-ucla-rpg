export default {
  name: "Desacreditar",
  critReduction: 45,
  description() {
    return `🧿 PASSIVA — Desacreditar
Sempre que Rália sofrer um Acerto Crítico ou receber dano de qualquer fonte que não ela própria:
O bônus de dano do crítico é reduzido em −${this.critReduction} (mínimo 0).
Se o bônus for reduzido a 0, o atacante não ativa efeitos ligados a crítico neste acerto.`;
  },

  hookScope: {
    onBeforeDmgTaking: "target",
  },

  onBeforeDmgTaking({ source, target, owner, crit, context }) {
    /* console.log(
      `[PASSIVA RÁLIA] Entrou | Crit=${crit.didCrit} | Bônus atual=${crit.bonus}% | Atacante=${source.name}`,
    );
    */
    let { critExtra } = crit;
    critExtra = Number(critExtra) || 0;

    if (!crit.didCrit) return;
    const reducedBonus = Math.max(critExtra - this.critReduction, 0);
    if (reducedBonus === 0) {
      return {
        crit: {
          ...crit,
          didCrit: false,
          critExtra: 0,
        },
      };
    }
    return {
      crit: {
        ...crit,
        critExtra: reducedBonus,
      },
    };
  },
};
