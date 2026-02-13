import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Mar que Retorna",
  description: `
        Sempre que Naelys receber dano,
        ele se cura em +5 para cada 25 de HP perdido neste acerto.
        (Máx. +35 por acerto)`,
  afterDamageTaken({ target, attacker, damage, self }) {
    if (damage <= 0) return;

    if (self !== target) return;

    let heal = Math.floor(damage / 25) * 5;

    heal = Math.min(heal, 35);

    if (heal <= 0) return;

    const before = self.HP;
    self.heal(heal);

    console.log(
      `[PASSIVA NAELYS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${self.HP}`,
    );

    const selfName = formatChampionName(self);
    return {
      log: `[PASSIVA — Mar que Retorna] ${selfName} recuperou ${heal} HP.`,
    };
  },
};
