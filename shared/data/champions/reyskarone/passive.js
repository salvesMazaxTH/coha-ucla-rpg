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
    onAfterLifeSteal: "undefined",
    onAfterDmgTaking: "defender"
  },

  onAfterLifeSteal({ source, amount, owner, context }) {
    // ✔ Só aliados, ignorar o próprio Reyskarone
    /* console.log(
      "PASSIVA REYSKARONE DISPARADA",
      "owner:",
      owner?.name,
      "source:",
      source?.name,
      "amount:",
      amount,
    );
    */

    // validações básicas
    if (!source || !owner) return;
    // não triggar em inimigos
    if (source.team !== owner.team) return;
    // ignorar self (se quiser manter essa regra)
    if (source === owner) return;

    const heal = amount * (this.lifeStealHealPercent / 100);
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    owner.heal(heal, context);

    return {
      log: `↳ [PASSIVA — Ecos de Vitalidade] ${formatChampionName(owner)} absorveu ecos vitais de ${formatChampionName(source)} (+${heal} HP).`,
    };
  },

  /* ------------------
  // APENAS PARA TESTES //
  * -------------------*/
    onAfterDmgTaking({attacker, defender, owner, context}) {
      owner.portrait = "/assets/portraits/reyskarone_bombado.webp"
    }
};
