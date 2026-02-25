const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  name: "Sobrecarga Instável",
  recoilPercent: 20,
  sobrecargaDuration: 2,
  sobrecargaBonusPercent: 15,
  description() {
    return `Sempre que Voltexz causar dano, ela sofre ${this.recoilPercent}% do dano efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Sobrecarga". Ao atacar um alvo com "Sobrecarga", Voltexz causa ${this.sobrecargaBonusPercent}% de dano adicional (consome o status) (Dano adicional Mín. 15).`;
  },

  onAfterDmgDealing({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (owner?.id !== dmgSrc?.id) return;

    if ((context.damageDepth ?? 0) > 0) return; // Evita recuo em dano causado pelo próprio recuo e etc.

    let log = "";

    let recoilDamage = 0;

    if (damage > 0) {
      recoilDamage = editMode
        ? 999
        : Math.round((damage * (this.recoilPercent / 100)) / 5) * 5;
    }

    context.extraDamageQueue ??= [];

    if (recoilDamage > 0) {
      context.extraDamageQueue.push({
        type: "recuo_dano",
        mode: "direct",
        baseDamage: recoilDamage,
        directDamage: recoilDamage,
        user: owner,
        source: owner,
        target: owner,
        skill: {
          key: "sobrecarga_instavel_recoil",
        },
      });

      context.dialogEvents = context.dialogEvents || [];
      context.dialogEvents.push({
        type: "dialog",
        message: `${owner.name} sofre ${recoilDamage} de recuo por "Sobrecarga Instável"!`,
        sourceId: owner.id,
        targetId: owner.id,
      });
    }

    return { log };
  },

  onBeforeDmgDealing({ dmgSrc, dmgReceiver, owner, crit, damage, context }) {
    if (owner?.id !== dmgSrc?.id) return;

    if (!dmgReceiver.hasKeyword?.("sobrecarga")) return;

    const bonusDamage = Math.ceil((damage * this.sobrecargaBonusPercent) / 100);

    dmgReceiver.removeKeyword("sobrecarga");

    let log = `⚡ ACERTO ! ${dmgSrc.name} explorou "Sobrecarga" de ${dmgReceiver.name} (+${this.sobrecargaBonusPercent}% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
