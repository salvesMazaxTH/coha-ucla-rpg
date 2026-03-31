import { formatChampionName } from "../../../ui/formatters.js";

formatChampionName

export default {
  key: "torren_passive",
  name: "Torren-PASSIVE",

  description() {
    return `Só pode sofrer dano direto de habilidades. Dano ao longo do tempo e efeitos não o afetam. Além disso, Torren recebe 10% a menos de dano de todas as fontes (exceto Dano Absoluto).`;
  },

  hookScope: {
    onDamageIncoming: "defender",
    onBeforeDmgTaking: "defender",
  },

  onDamageIncoming({ attacker, defender, skill, damage, context, owner }) {
    if (context.damageDepth > 0 && damage > 0) {
      return {
        cancel: true,
        immune: true,
        message: `<b>[Passiva - ${this.name}]</b> ${formatChampionName(defender)} é imune a dano indireto!`,
      };
    }
  },

  onBeforeDmgTaking({ attacker, defender, skill, damage, context, owner }) {
    return {
      damage: damage * 0.9,
    };
  },
};
