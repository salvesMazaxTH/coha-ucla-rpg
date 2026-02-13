const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  name: "Sobrecarga Instável",
  description: `Sempre que Voltexz causar dano, ela sofre 20% do dano efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Sobrecarga". Ao atacar um alvo com "Sobrecarga", Voltexz causa 15% de dano adicional (consome o status) (Dano adicional Mín. 15).`,

  afterDamageTaken({
    attacker,
    target,
    damage,
    damageType,
    context,
    self,
  }) {
    if (self !== attacker) return;

    let log = "";

    if (damage > 0) {
      const recoilDamage = editMode
        ? 999
        : Math.round((damage * 0.2) / 5) * 5;

      if (recoilDamage > 0) {
        self.takeDamage(recoilDamage);
        log += `⚡ ${self.name} sofreu ${recoilDamage} de dano de recuo por Sobrecarga Instável!`;
      }
    }

    target.applyKeyword("sobrecarga", 2, context);
    log += `\n⚡ ${target.name} foi marcado com "Sobrecarga"!`;

    return { log };
  },

  beforeDamageDealt({ attacker, crit, target, damage, context, self }) {
    if (self !== attacker) return;

    if (!target.hasKeyword?.("sobrecarga")) return;

    const bonusDamage = Math.ceil((damage * 15) / 100);

    target.removeKeyword("sobrecarga");

    let log = `⚡ ACERTO ! ${attacker.name} explorou "Sobrecarga" de ${target.name} (+15% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
