import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Ecos de Vitalidade",
  lifeStealHealPercent: 35,
  tributeBonusDamage: 10,
  tributeHeal: 15,
  description() {
    return `Sempre que um aliado curar por Roubo de Vida, Reyskarone recupera ${this.lifeStealHealPercent}% desse valor.`;
  },

  onAfterLifeSteal({ source, amount, owner, context }) {
    // ✔ Só aliados, ignorar o próprio Reyskarone
    if (source.team !== owner.team || source === owner) return;

    const heal =
      Math.round((amount * (this.lifeStealHealPercent / 100)) / 5) * 5;
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    owner.heal(heal, context);

    return {
      log: `↳ [PASSIVA — Ecos de Vitalidade] ${formatChampionName(owner)} absorveu ecos vitais de ${formatChampionName(source)} (+${heal} HP).`,
    };
  },
};
