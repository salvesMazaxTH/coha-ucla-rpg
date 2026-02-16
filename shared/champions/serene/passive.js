import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Calmaria Protetora",
  healPercent: 15,
  description() {
    return `Sempre que Serene terminar um turno sem ter seu HP reduzido,
ela cura ${this.healPercent}% do seu HP máximo no início do próximo turno.`;
  },

  // Marca dano recebido no turno
  afterDamageTaken({ target, attacker, context, self }) {
    if (self !== target) return;
    self.runtime.sereneDamagedTurn = context.currentTurn;
  },

  // Executa no início do turno
  onTurnStart({ self, context }) {
    const lastDamaged = self.runtime.sereneDamagedTurn;

    // Se NÃO tomou dano no turno anterior
    if (lastDamaged === context.currentTurn - 1) return;

    const heal = Math.round((self.maxHP * 0.15) / 5) * 5;
    if (heal <= 0 || self.HP >= self.maxHP) return;

    const before = self.HP;
    self.heal(heal, context);

    return {
      log: `[PASSIVA — Calmaria Protetora] ${formatChampionName(self)} recuperou ${heal} HP (${before} → ${self.HP}).`,
    };
  },
};
