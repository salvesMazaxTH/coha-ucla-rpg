import { formatChampionName } from "../../../ui/formatters.js";

const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  key: "sobrecarga_instavel",
  name: "Sobrecarga Instável",
  recoilPercent: 20,
  sobrecargaDuration: 2,
  sobrecargaBonusPercent: 15,
  description() {
    return `Sempre que Voltexz causar dano com uma habilidade, ela sofre ${this.recoilPercent}% do dano ({absoluto}) efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Sobrecarga". Ao atacar um alvo com "Sobrecarga", Voltexz causa ${this.sobrecargaBonusPercent}% de dano adicional (consome o status) (Dano adicional Mín. 15).`;
  },
  hookScope: {
    onAfterDmgDealing: "source",
    onBeforeDmgDealing: "source",
  },

  onAfterDmgDealing({ source, target, owner, skill, damage, context }) {
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
        mode: "absolute",
        baseDamage: recoilDamage,
        piercingPortion: recoilDamage,
        attacker: owner,
        source: owner,
        defender: owner,
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

    if (target.hasStatusEffect?.("sobrecarga")) {
      target.removeStatusEffect("sobrecarga");
      return;
    }

    target.applyStatusEffect("sobrecarga", this.sobrecargaDuration, context, {
      sourceSkill: skill,
    });

    return { log };
  },

  onBeforeDmgDealing({ source, target, owner, crit, damage, context, skill }) {
    console.log("🔥 onBeforeDmgDealing TRIGGER:", formatChampionName(source));

    console.log("OWNER:", owner?.name);
    console.log("DMG SRC:", source?.name);
    console.log("ALVO:", target?.name);
    console.log("HAS SOBRECARGA?", target?.hasStatusEffect?.("sobrecarga"));

    if (!target.hasStatusEffect?.("sobrecarga")) return;

    const bonusDamage = Math.ceil((damage * this.sobrecargaBonusPercent) / 100);

    target.removeStatusEffect("sobrecarga");

    context.visual.dialogEvents.push({
      type: "dialog",
      message: `${formatChampionName(target)} foi consumido por "Sobrecarga"!`,
      sourceId: source.id,
      targetId: target.id,
      blocking: false,
    });

    let log = `⚡ ACERTO ! ${formatChampionName(source)} explorou "Sobrecarga" de ${formatChampionName(target)} (+${this.sobrecargaBonusPercent}% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
