export default {
  name: "Sede de Sangue",
  critBuff: 15,
  critCap: 95,
  critThreshold: 50,
  enhancedCritBonus: 85,
  description() {
    return `Cada acerto crítico aumenta a chance de crítico em +${this.critBuff}% (máx. ${this.critCap}%). Quando a chance de crítico ultrapassa ${this.critThreshold}%, o bônus de crítico sobe para 1,${this.enhancedCritBonus}x.`;
  },
  onCriticalHit({ critSrc, target, context, owner }) {
    if (critSrc !== owner) return; // só ativa para o próprio Vael
    owner.modifyStat({
      statName: "Critical",
      amount: this.critBuff,
      context,
      isPermanent: true,
    });
    if (owner.Critical > this.critThreshold) {
      owner.critBonusOverride = this.enhancedCritBonus;
    }
    console.log(
      `${owner.name} ganhou +${this.critBuff}% Critical por causa de Sede de Sangue! Critical atual: ${owner.Critical}%` +
        (owner.critBonusOverride === this.enhancedCritBonus
          ? ` | Bônus de crítico: 1.${this.enhancedCritBonus}x`
          : ``),
    );
  },
};
