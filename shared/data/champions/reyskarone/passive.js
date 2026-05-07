import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "Ecos de Vitalidade",
  lifeStealHealPercent: 35,
  tributeBonusDamage: 10,
  tributeHeal: 15,
  description() {
    return `Sempre que um aliado curar por Roubo de Vida, Reyskarone recupera ${this.lifeStealHealPercent}% desse valor.`;
  },

  hookScope: {
    onAfterHealing: undefined,
    onAfterDmgTaking: "defender",
  },

  onAfterHealing({ healSrc, amount, owner, context, isLifesteal }) {
    if (!isLifesteal) return;

    // validações básicas
    if (!healSrc || !owner) return;
    // não triggar em inimigos
    if (healSrc.team !== owner.team) return;
    // ignorar self (se quiser manter essa regra)
    if (healSrc === owner) return;

    const heal = Math.floor(amount * (this.lifeStealHealPercent / 100));
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    owner.heal(heal, context);

    return {
      log: `↳ [PASSIVA — Ecos de Vitalidade] ${formatChampionName(owner)} absorveu ecos vitais de ${formatChampionName(healSrc)} (+${heal} HP).`,
    };
  },

  /* ------------------
  // APENAS PARA TESTES //
  * -------------------*/
  onAfterDmgTaking({ attacker, defender, owner, context }) {
    owner.portrait = "/assets/portraits/reyskarone_bombado.webp";
  },
};
