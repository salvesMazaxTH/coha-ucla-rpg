export default {
  name: "Desacreditar",
  description: `🧿 PASSIVA — Desacreditar
      Sempre que Rália sofrer um Acerto Crítico ou receber dano de qualquer fonte que não ela própria:
      O bônus de dano do crítico é reduzido em −45 (mínimo 0).
      Se o bônus for reduzido a 0, o atacante não ativa efeitos ligados a crítico neste acerto.
`,
  beforeDamageTaken({ crit, attacker, target, self, context }) {
    if (self !== target) return;
    console.log(
      `[PASSIVA RÁLIA] Entrou | Crit=${crit.didCrit} | Bônus atual=${crit.bonus}% | Atacante=${attacker.name}`,
    );
    let { critExtra } = crit;
    critExtra = Number(critExtra) || 0;

    if (!crit.didCrit) return;
    const reducedBonus = Math.max(critExtra - 45, 0);
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
