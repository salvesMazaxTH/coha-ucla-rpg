export default {
  key: "olhar_que_encontra_a_falha",
  name: "Olhar que Encontra a Falha",

  // Scaling de crítico
  critPerHit: 3,

  // Conversão de excesso em dano
  critConversionThreshold: 55,
  critOverflowToDamage: 1.2,

  // Bônus fixo em acertos críticos
  critBonusFlat: 35,

  description() {
    return `
    Cada ataque aumenta permanentemente a chance de crítico em +${this.critPerHit}%.

    Quando ultrapassa ${this.critConversionThreshold}%, o excesso é convertido em dano adicional (${this.critOverflowToDamage * 100}% do excesso).

    Acertos críticos recebem +${this.critBonusFlat} de dano adicional.
    `;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, context }) {
    owner.modifyStat({
      statName: "Critical",
      amount: this.critPerHit,
      context,
      isPermanent: true,
    });
  },

  onBeforeDmgDealing({ owner, damage, crit }) {
    let bonusDamage = 0;

    // Conversão de excesso de crítico em dano adicional
    if (owner.Critical > this.critConversionThreshold) {
      const overflow = owner.Critical - this.critConversionThreshold;
      bonusDamage += overflow * this.critOverflowToDamage;
    }

    // Bônus fixo ao critar
    if (crit?.didCrit) {
      bonusDamage += this.critBonusFlat;
    }

    if (bonusDamage <= 0) return;

    return {
      damage: damage + bonusDamage,
    };
  },
};