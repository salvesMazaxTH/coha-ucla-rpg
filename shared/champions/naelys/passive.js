import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Mar que Retorna",
  healPerStack: 5,
  hpPerStack: 25,
  maxHeal: 35,
  description() {
    return `Sempre que Naelys receber dano,
ele se cura em +${this.healPerStack} para cada ${this.hpPerStack} de HP perdido neste acerto.
(Máx. +${this.maxHeal} por acerto)`;
  },
  afterDamageTaken({ target, attacker, damage, self, context }) {
    if (damage <= 0) return;

    if (self !== target) return;

    let heal = Math.floor(damage / this.hpPerStack) * this.healPerStack;

    heal = Math.min(heal, this.maxHeal);

    if (heal <= 0) return;

    const before = self.HP;
    self.heal(heal, context);

    console.log(
      `[PASSIVA NAELYS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${self.HP}`,
    );

    const selfName = formatChampionName(self);
    return {
      log: `[PASSIVA — Mar que Retorna] ${selfName} recuperou ${heal} HP.`,
    };
  },
};
