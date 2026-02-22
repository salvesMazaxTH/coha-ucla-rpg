import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Calmaria Protetora",
  healPercent: 15,
  description() {
    return `Sempre que Serene terminar um turno sem ter seu HP reduzido, ela cura ${this.healPercent}% do seu HP máximo no início do próximo turno.`;
  },

  // Marca dano recebido no turno
  afterDamageTaken({ dmgSrc, dmgReceiver, owner, context }) {
    if (owner?.id !== dmgReceiver?.id) return;
    owner.runtime = owner.runtime || {};
    owner.runtime.sereneDamagedTurn = context.currentTurn;
  },

  // Executa no início do turno
  onTurnStart({ owner, context }) {
    const lastDamaged = owner.runtime.sereneDamagedTurn;

    // Se NÃO tomou dano no turno anterior
    if (lastDamaged === context.currentTurn - 1) return;

    const heal = Math.round((owner.maxHP * 0.15) / 5) * 5;
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    const before = owner.HP;
    owner.heal(heal, context);

    return {
      log: `[PASSIVA — Calmaria Protetora] ${formatChampionName(owner)} recuperou ${heal} HP (${before} → ${owner.HP}).`,
    };
  },
};
