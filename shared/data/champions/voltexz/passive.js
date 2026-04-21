import { formatChampionName } from "../../../ui/formatters.js";

const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas.

export default {
  key: "sobrecarga_instavel",
  name: "Sobrecarga Instável",
  recoilPercent: 15,
  conductorDuration: 2,
  conductorBonusPercent: 15,
  description() {
    return `Sempre que Voltexz causar dano com uma habilidade, ela sofre ${this.recoilPercent}% do dano ({absoluto}) efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Condutor". Ao atacar um alvo com "Condutor", Voltexz causa ${this.conductorBonusPercent}% de dano adicional (consome o status) (Dano adicional Mín. 15).`;
  },
  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ attacker, defender, owner, skill, damage, context }) {
    if ((context.damageDepth ?? 0) > 0) return; // Evita recuo em dano causado pelo próprio recuo e etc.

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
        attacker: owner,
        source: owner,
        defender: owner,
        skill: {
          key: "sobrecarga_instavel_recoil",
          name: "Recuo (Sobrecarga Instável)",
          suppressLog: true, // <- flag para suprimir log padrão
        },

        dialog: {
          message: `${formatChampionName(owner)} sofreu ${Math.floor(recoilDamage)} de recuo por "<b>Sobrecarga Instável</b>"!`,
          duration: 1000,
        },
      });
      log += `[Passiva - <b>Sobrecarga Instável</b>] ${formatChampionName(owner)} sofreu ${Math.floor(recoilDamage)} de dano de recuo.`;
    }

    if (defender.hasStatusEffect?.("conductor")) {
      defender.removeStatusEffect("conductor");
      return;
    }

    defender.applyStatusEffect("conductor", this.conductorDuration, context, {
      sourceSkill: skill,
    });

    return { log };
  },

  onBeforeDmgDealing({
    attacker,
    defender,
    owner,
    crit,
    damage,
    context,
    skill,
  }) {
    // console.log("🔥 onBeforeDmgDealing TRIGGER:", formatChampionName(attacker));

    // console.log("OWNER:", owner?.name);
    // console.log("DMG SRC:", attacker?.name);
    // console.log("ALVO:", defender?.name);
    // console.log("HAS CONDUTOR?", defender?.hasStatusEffect?.("conductor"));

    if (!defender.hasStatusEffect?.("conductor")) return;

    const bonusDamage = (damage * this.conductorBonusPercent) / 100;

    defender.removeStatusEffect("conductor");

    context.registerDialog({
      message: `${formatChampionName(defender)} foi consumido por <b>"Condutor"</b>!`,
      sourceId: attacker.id,
      targetId: defender.id,
      duration: 1000,
      timing: "post",
    });

    let log = `⚡ ACERTO ! ${formatChampionName(attacker)} explorou "Condutor" de ${formatChampionName(defender)} (+${this.conductorBonusPercent}% dano)!`;

    return {
      damage: damage + bonusDamage,
      log,
    };
  },
};
