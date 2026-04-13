export default {
  key: "lamina_que_procura_a_falha",
  name: "Lâmina que Procura a Falha",
  critBuff: 15,
  critCap: 95,
  critThreshold: 50,
  enhancedCritBonus: 85,
  description() {
    return `Cada acerto crítico aumenta a chance de crítico em +${this.critBuff}% (máx. ${this.critCap}%). Quando a chance de crítico ultrapassa ${this.critThreshold}%, o bônus de crítico sobe para 1,${this.enhancedCritBonus}x.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onCriticalHit: "attacker",
  },

  onBeforeDmgDealing({ owner, context, crit }) {
    if (owner.Critical > this.critThreshold) {
      owner.critBonusOverride = this.enhancedCritBonus;
      // retorna crit atualizado para a pipeline detectar a mudança e recompor
      if (crit?.didCrit) {
        return { crit: { ...crit, bonus: this.enhancedCritBonus } };
      }
    } else {
      owner.critBonusOverride = undefined;
    }
  },

  onCriticalHit({ owner, context }) {
    // Buffa a chance de crítico ao acertar crítico
    owner.modifyStat({
      statName: "Critical",
      amount: this.critBuff,
      context,
      isPermanent: true,
    });
  },
};
