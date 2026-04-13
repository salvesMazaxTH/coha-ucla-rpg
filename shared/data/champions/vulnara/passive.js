export default {
  key: "chama_ascendente",
  name: "Chama Ascendente",
  critCap: 95,
  enhancedCritBonus: 70,
  atkBuff: 5,
  description() {
    return `Cada acerto crítico de Vulnara aumenta seu Ataque em ${this.atkBuff}. O bônus de crítico de Vulnara é 1,${this.enhancedCritBonus}x.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onCriticalHit: "attacker",
  },

  onBeforeDmgDealing({ owner, context, crit }) {
    // bônus de crítico dela é sempre 1,70x
    owner.critBonusOverride = this.enhancedCritBonus;
    // retorna crit atualizado para a pipeline detectar a mudança e recompor
    if (crit?.didCrit) {
      return { crit: { ...crit, bonus: this.enhancedCritBonus } };
    }
  },

  onCriticalHit({ owner, context }) {
    owner.modifyStat({
      statName: "Attack",
      amount: this.atkBuff,
      context,
      isPermanent: true,
    });
  },
};
