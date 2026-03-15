export default {
  key: "chama_ascendente",
  name: "Chama Ascendente",
  critBuff: 5,
  critCap: 95,
  enhancedCritBonus: 70,
  atkBuff: 5,
  description() {
    return `Cada acerto crítico de Vulnara aumenta seu Ataque em ${this.atkBuff}. Cada vez que causa dano, aumenta a chance de crítico em +${this.critBuff}% (máx. ${this.critCap}%). O bônus de crítico de Vulnara é 1,${this.enhancedCritBonus}x.`;
  },

  hookScope: {
    onCriticalHit: "source",
    onAfterDmgDealing: "source",
  },

  onCriticalHit({ target, context, owner }) {
    owner.modifyStat({
      statName: "Attack",
      amount: this.atkBuff,
      context,
      isPermanent: true,
    });
    // bônus de crítico dela é sempre 1,70x
    owner.critBonusOverride = this.enhancedCritBonus;

    /* console.log(
      `[PASSIVA — Chama Ascendente] ${owner.name} ganhou +${this.atkBuff} de Ataque. Ataque atual: ${owner.Attack}`,
    );
    */
  },

  onAfterDmgDealing({ source, target, owner, skill, damage, context }) {
    owner.modifyStat({
      statName: "Critical",
      amount: 5,
      context,
      isPermanent: true,
    });

    return {
      log: `[PASSIVA — Chama Ascendente] ${owner.name} ganhou +5% Critical.`,
    };
  },
};
