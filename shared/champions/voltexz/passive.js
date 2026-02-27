import { formatChampionName } from "../../core/formatters.js";

const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  name: "Sobrecarga Instável",
  recoilPercent: 20,
  sobrecargaDuration: 2,
  sobrecargaBonusPercent: 15,
  description() {
    return `Sempre que Voltexz causar dano com uma habilidade, ela sofre ${this.recoilPercent}% do dano efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Sobrecarga". Ao atacar um alvo com "Sobrecarga", Voltexz causa ${this.sobrecargaBonusPercent}% de dano adicional (consome o status) (Dano adicional Mín. 15).`;
  },

  onAfterDmgDealing({ dmgSrc, dmgReceiver, owner, skill, damage, context }) {
    if (owner?.id !== dmgSrc?.id) return;

    if ((context.damageDepth ?? 0) > 0) return; // Evita recuo em dano causado pelo próprio recuo e etc.

    // Ataque Básico não aplica recuo nem Sobrecarga
    if (skill.key === "ataque_basico") return;

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

      context.visual.dialogEvents = context.visual.dialogEvents || [];
      context.visual.dialogEvents.push({
        type: "dialog",
        message: `${formatChampionName(owner)} sofreu ${recoilDamage} de recuo por "Sobrecarga Instável"!`,
        sourceId: owner.id,
        targetId: owner.id,
        blocking: false,
      });
    }

    if (dmgReceiver.hasKeyword?.("sobrecarga")) {
      dmgReceiver.removeKeyword("sobrecarga");
      return;
    } 

    dmgReceiver.applyKeyword("sobrecarga", this.sobrecargaDuration, context, {
      sourceSkill: skill,
    });

    return { log };
  },

  onBeforeDmgDealing({
    dmgSrc,
    dmgReceiver,
    owner,
    crit,
    damage,
    context,
    skill,
  }) {
    console.log("🔥 onBeforeDmgDealing TRIGGER:", formatChampionName(dmgSrc));

    console.log("OWNER:", owner?.name);
    console.log("DMG SRC:", dmgSrc?.name);
    console.log("ALVO:", dmgReceiver?.name);
    console.log("HAS SOBRECARGA?", dmgReceiver?.hasKeyword?.("sobrecarga"));

    if (owner?.id !== dmgSrc?.id) return;

    if (!dmgReceiver.hasKeyword?.("sobrecarga")) return;

    const bonusDamage = Math.ceil((damage * this.sobrecargaBonusPercent) / 100);

    dmgReceiver.removeKeyword("sobrecarga");

    context.dialogEvents.push({
      type: "dialog",
      message: `${formatChampionName(dmgReceiver)} foi consumido por "Sobrecarga"!`,
      sourceId: dmgSrc.id,
      targetId: dmgReceiver.id,
      blocking: false,
    });

    let log = `⚡ ACERTO ! ${formatChampionName(dmgSrc)} explorou "Sobrecarga" de ${formatChampionName(dmgReceiver)} (+${this.sobrecargaBonusPercent}% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
