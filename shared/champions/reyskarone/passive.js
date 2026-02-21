import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Ecos de Vitalidade",
  lifeStealHealPercent: 35,
  tributeBonusDamage: 10,
  tributeHeal: 15,
  description() {
    return `Sempre que um aliado curar por Roubo de Vida, Reyskarone recupera ${this.lifeStealHealPercent}% desse valor.`;
  },

  onLifeSteal({ source, amount, self, context }) {
    // ✔ Só aliados, ignorar o próprio Reyskarone
    if (source.team !== self.team && source !== self) return;

    const heal =
      Math.round((amount * (this.lifeStealHealPercent / 100)) / 5) * 5;
    if (heal <= 0 || self.HP >= self.maxHP) return;

    self.heal(heal, context);

    return {
      log: `↳ [PASSIVA — Ecos de Vitalidade] ${formatChampionName(self)} absorveu ecos vitais de ${formatChampionName(source)} (+${heal} HP).`,
    };
  },

  beforeDamageDealt({ dmgSource, dmgTarget, damage, context, owner }) {
    // alvo não tem tributo
    if (!dmgTarget.hasKeyword?.("tributo")) return;

    // só aliados do Reyskarone
    if (owner.team !== this.team) return;

    // não buffa inimigos nem neutros
    if (damage <= 0) return;

    const bonus = this.tributeBonusDamage;

    return {
      damage: damage + bonus,
      log: `🩸 Tributo amplificou o golpe de ${owner.name} (+${bonus} dano)`,
    };
  },

  afterDamageDealt({ dmgSource, dmgTarget, context, owner }) {
    if (!dmgTarget.hasKeyword?.("tributo")) return;

    // só aliados do Reyskarone
    if (owner.team !== this.team) return;

    const heal = this.tributeHeal;
    if (heal <= 0 || owner.HP >= owner.maxHP) return;
    owner.heal(heal, context);

    return {
      log: `🩸 Tributo: ${owner.name} recuperou ${heal} HP.`,
    };
  },
};
