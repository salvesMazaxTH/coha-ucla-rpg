const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  name: "Sobrecarga Instável",
  recoilPercent: 20,
  sobrecargaDuration: 2,
  sobrecargaBonusPercent: 15,
  description() {
    return `Sempre que Voltexz causar dano, ela sofre ${this.recoilPercent}% do dano efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Sobrecarga". Ao atacar um alvo com "Sobrecarga", Voltexz causa ${this.sobrecargaBonusPercent}% de dano adicional (consome o status) (Dano adicional Mín. 15).`;
  },

  afterDamageTaken({
    dmgSource,
    dmgTarget,
    damage,
    damageType,
    context,
    owner,
  }) {
    if (owner !== dmgTarget) return;

    let log = "";
    if (damage > 0) {
      const recoilDamage = editMode
        ? 999
        : Math.round((damage * (this.recoilPercent / 100)) / 5) * 5;

      if (recoilDamage > 0) {
        owner.takeDamage(recoilDamage);
        log += `⚡ ${owner.name} sofreu ${recoilDamage} de dano de recuo por Sobrecarga Instável!`;
      }
    }

    const overloaded = dmgTarget.applyKeyword(
      "sobrecarga",
      this.sobrecargaDuration,
      context,
    );

    if (overloaded) {
      log += `\n⚡ ${dmgTarget.name} foi marcado com "Sobrecarga"!`;
    }

    return { log };
  },

  beforeDamageDealt({ dmgSource, crit, dmgTarget, damage, context, owner }) {
    if (owner !== dmgSource) return;

    if (!dmgTarget.hasKeyword?.("sobrecarga")) return;

    const bonusDamage = Math.ceil((damage * this.sobrecargaBonusPercent) / 100);

    dmgTarget.removeKeyword("sobrecarga");

    let log = `⚡ ACERTO ! ${dmgSource.name} explorou "Sobrecarga" de ${dmgTarget.name} (+${this.sobrecargaBonusPercent}% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
