import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "mar_que_retorna",
  name: "Mar que Retorna",
  healPerStack: 5,
  hpPerStack: 25,
  maxHeal: 35,
  description() {
    return `Sempre que Naelthos receber dano (exceto dano ao longo do tempo),
    ele se cura em +${this.healPerStack} para cada ${this.hpPerStack} de HP perdido neste acerto.
    (Máx. +${this.maxHeal} por acerto)`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;
    if (context?.isDot) return;

    /* console.log(
      "PASSIVA NAELTHOS DISPARADA",
      "owner:",
      owner?.name,
      "receiver:",
      defender?.name,
    );
    */
    let heal = Math.floor(damage / this.hpPerStack) * this.healPerStack;

    heal = Math.min(heal, this.maxHeal);

    if (heal <= 0) return;

    const before = owner.HP;
    owner.heal(heal, context);

    /* console.log(
      `[PASSIVA NAELTHOS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${owner.HP}`,
    );
    */
    const ownerName = formatChampionName(owner);
    return {
      log: `[PASSIVA — Mar que Retorna] ${ownerName} recuperou ${heal} HP.`,
    };
  },
};
