import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Ecos de Vitalidade",
  description: `
      Sempre que um aliado curar por Roubo de Vida,Reyskarone recupera 35% desse valor.`,

  onLifeSteal({ source, amount, self }) {
    // ✔ Só aliados, ignorar o próprio Reyskarone
    if (source.team !== self.team && source !== self) return;

    const heal = Math.round((amount * 0.35) / 5) * 5;
    if (heal <= 0 || self.HP >= self.maxHP) return;

    self.heal(heal);

    return {
      log: `↳ [PASSIVA — Ecos de Vitalidade] ${formatChampionName(self)} absorveu ecos vitais de ${formatChampionName(source)} (+${heal} HP).`,
    };
  },

  beforeDamageDealt({ attacker, target, damage, self }) {
    // alvo não tem tributo
    if (!target.hasKeyword?.("tributo")) return;

    // só aliados do Reyskarone
    if (attacker.team !== self.team) return;

    // não buffa inimigos nem neutros
    if (damage <= 0) return;

    const bonus = 10;

    return {
      damage: damage + bonus,
      log: `🩸 Tributo amplificou o golpe de ${attacker.name} (+${bonus} dano)`,
    };
  },

  afterDamageDealt({ attacker, target, context, self }) {
    if (!target.hasKeyword?.("tributo")) return;

    // só aliados do Reyskarone
    if (attacker.team !== self.team) return;

    const heal = 15;
    if (heal <= 0 || attacker.HP >= attacker.maxHP) return;
    attacker.heal(heal);

    return {
      log: `🩸 Tributo: ${attacker.name} recuperou ${heal} HP.`,
    };
  },
};
