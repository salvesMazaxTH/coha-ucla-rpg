import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Mar que Retorna",
  healPerStack: 5,
  hpPerStack: 25,
  maxHeal: 35,
  description() {
    return `Sempre que Naelthos receber dano,
ele se cura em +${this.healPerStack} para cada ${this.hpPerStack} de HP perdido neste acerto.
(Máx. +${this.maxHeal} por acerto)`;
  },
  afterDamageTaken({ dmgSource, dmgTarget, damage, context, owner }) {
    if (damage <= 0) return;

    if (owner !== dmgTarget) return;

    let heal = Math.floor(damage / this.hpPerStack) * this.healPerStack;

    heal = Math.min(heal, this.maxHeal);

    if (heal <= 0) return;

    const before = owner.HP;
    owner.heal(heal, context);

    console.log(
      `[PASSIVA NAELTHOS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${owner.HP}`,
    );

    const ownerName = formatChampionName(owner);
    return {
      log: `[PASSIVA — Mar que Retorna] ${ownerName} recuperou ${heal} HP.`,
    };
  },
};
