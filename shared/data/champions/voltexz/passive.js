import { formatChampionName } from "../../../ui/formatters.js";

const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  key: "sobrecarga_instavel",
  name: "Sobrecarga Instável",
  recoilPercent: 20,
  condutorDuration: 2,
  condutorBonusPercent: 15,
  description() {
    return `Sempre que Voltexz causar dano com uma habilidade, ela sofre ${this.recoilPercent}% do dano ({absoluto}) efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Condutor". Ao atacar um alvo com "Condutor", Voltexz causa ${this.condutorBonusPercent}% de dano adicional (consome o status) (Dano adicional Mín. 15).`;
  },
  hookScope: {
    onAfterDmgDealing: "source",
    onBeforeDmgDealing: "source",
  },

  onAfterDmgDealing({ source, target, owner, skill, damage, context }) {
    if ((context.damageDepth ?? 0) > 0) return; // Evita recuo em dano causado pelo próprio recuo e etc.

    // Ataque Básico não aplica recuo nem Condutor
    if (skill.key === "ataque_basico") return;

    let log = "";

    let recoilDamage = 0;

    if (damage > 0) {
      recoilDamage = editMode ? 999 : damage * (this.recoilPercent / 100);
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

      context.registerDialog({
        message: `${formatChampionName(owner)} sofreu ${Math.floor(recoilDamage)} de recuo por "<b>Sobrecarga Instável</b>"!`,
        sourceId: owner.id,
        targetId: owner.id,
        blocking: false,
      });
    }

    if (target.hasStatusEffect?.("condutor")) {
      target.removeStatusEffect("condutor");
      return;
    }

    target.applyStatusEffect("condutor", this.condutorDuration, context, {
      sourceSkill: skill,
    });

    return { log };
  },

  onBeforeDmgDealing({ source, target, owner, crit, damage, context, skill }) {
    // console.log("🔥 onBeforeDmgDealing TRIGGER:", formatChampionName(source));

    // console.log("OWNER:", owner?.name);
    // console.log("DMG SRC:", source?.name);
    // console.log("ALVO:", target?.name);
    // console.log("HAS CONDUTOR?", target?.hasStatusEffect?.("condutor"));

    if (!target.hasStatusEffect?.("condutor")) return;

    const bonusDamage = (damage * this.condutorBonusPercent) / 100;

    target.removeStatusEffect("condutor");

    context.registerDialog({
      message: `${formatChampionName(target)} foi consumido por <b>"Condutor"</b>!`,
      sourceId: source.id,
      targetId: target.id,
      blocking: false,
    });

    let log = `⚡ ACERTO ! ${formatChampionName(source)} explorou "Condutor" de ${formatChampionName(target)} (+${this.condutorBonusPercent}% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
