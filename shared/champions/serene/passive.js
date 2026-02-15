import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Calmaria Protetora",
  description: `Sempre que Serene terminar um turno sem ter seu HP reduzido,
  ela cura 15% do seu HP máximo no início do próximo turno.`,

  // Marca dano recebido no turno
  afterDamageTaken({ target, attacker, context, self }) {
    if (self !== target) return;
    self.runtime.sereneDamagedTurn = context.currentTurn;
  },

  // Executa no início do turno
  onTurnStart({ target, context }) {
    const self = target;
    const lastDamaged = self.runtime.sereneDamagedTurn;

    if (self !== target) return;

    // Se NÃO tomou dano no turno anterior
    if (lastDamaged === context.currentTurn - 1) return;

    const heal = Math.round((target.maxHP * 0.15) / 5) * 5;
    if (heal <= 0 || target.HP >= target.maxHP) return;

    const before = target.HP;
    target.heal(heal, context);

    return {
      log: `[PASSIVA — Calmaria Protetora] ${formatChampionName(target)} recuperou ${heal} HP (${before} → ${target.HP}).`,
    };
  },
};
