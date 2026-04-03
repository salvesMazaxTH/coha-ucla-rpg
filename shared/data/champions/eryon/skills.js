import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const eryonSkills = [
  // =========================
  // Disparo Básico (global)
  // =========================

  basicShot,
  // =========================
  // Habilidades Especiais
  // =========================

  {
    key: "equalizacao_convergente",
    name: "Equalização Convergente",

    priority: -1,
    description() {
      return `Ajusta o ultômetro de todos os aliados para a média atual +2 unidades.`;
    },
    targetSpec: ["self"],
    resolve({ user, context, resolver }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      if (!allies.length) return;

      const total = allies.reduce((sum, c) => sum + c.ultMeter, 0);
      const avg = Math.floor(total / allies.length);

      for (const ally of allies) {
        const targetValue = Math.min(ally.ultCap, avg + 2);
        const delta = targetValue - ally.ultMeter;

        if (delta !== 0) {
          resolver.applyResourceChange({
            target: ally,
            amount: delta,
            context,
            sourceId: user.id,
          });
        }
      }

      return {
        log: `${user.name} equalizou o fluxo de energia do time.`,
      };
    },
  },
];

export default eryonSkills;
