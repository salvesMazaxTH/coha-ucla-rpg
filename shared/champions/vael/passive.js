export default {
  name: "Sede de Sangue",
  critBuff: 15,
  critCap: 95,
  critThreshold: 50,
  enhancedCritBonus: 85,
  description() {
    return `Cada acerto crítico aumenta a chance de crítico em +${this.critBuff}% (máx. ${this.critCap}%). Quando a chance de crítico ultrapassa ${this.critThreshold}%, o bônus de crítico sobe para 1,${this.enhancedCritBonus}x.`;
  },
  onCriticalHit({ user, target, context }) {
    user.modifyStat({
      statName: "Critical",
      amount: this.critBuff,
      context,
      isPermanent: true,
    });
    if (user.Critical > this.critThreshold) {
      user.critBonusOverride = this.enhancedCritBonus;
    }
    console.log(
      `${user.name} ganhou +${this.critBuff}% Critical por causa de Sede de Sangue! Critical atual: ${user.Critical}%` +
        (user.critBonusOverride === this.enhancedCritBonus
          ? ` | Bônus de crítico: 1.${this.enhancedCritBonus}x`
          : ``),
    );
  },
};
