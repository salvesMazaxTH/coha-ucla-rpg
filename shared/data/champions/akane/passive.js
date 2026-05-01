export default {
  key: "corte_perfurante_absoluto",
  name: "Corte Perfurante Absoluto",

  critBonus: 25,
  piercingRatio: 0.9,

  description() {
    return `Seus ataques sempre são críticos.

Acertos críticos causam apenas +${this.critBonus}% de dano, mas ignoram ${this.piercingRatio * 100}% da defesa do alvo.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ crit }) {
    const newCrit = {
      ...(crit ?? {}),
      didCrit: true,
      chance: 100,
      bonus: this.critBonus,
    };

    return {
      crit: newCrit,
      mode: "piercing",
      piercingPercentage: this.piercingRatio * 100,
    };
  },
};
