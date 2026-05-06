import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "metabolismo_toxico",
  name: "Metabolismo Tóxico",

  healPercent: 35,

  description() {
    return `Uma porcentagem do dano causado por <b>Envenenado</b> a qualquer personagem é convertida em cura para Tox Vipranna.`;
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  // Sem hookScope — dispara para Tox Vipranna sempre que onAfterDmgTaking for emitido,
  // independente de quem sofreu o dano (intenção: reagir a qualquer tick de Poisoned).
  onAfterDmgTaking({ owner, damage, context, skill }) {
    if (!context?.isDot) return;
    if (skill?.key !== "poisoned_tick") return;
    if (!damage || damage <= 0) return;

    const healAmount = Math.floor(damage * (this.healPercent / 100));
    if (healAmount <= 0) return;

    const before = owner.HP;
    const healed = owner.heal(healAmount, context);
    if (healed <= 0) return;

    const ownerName = formatChampionName(owner);
    return {
      log: `[PASSIVA — ${this.name}] ${ownerName} absorveu o veneno e recuperou ${healed} HP (${before} → ${owner.HP}).`,
    };
  },
};
