import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Energia Pulsante",
  description: `Node-SPARCKINA-07 gera uma onda de energia a cada turno, aumentando sua velocidade em 10%. As paralisias aplicadas por Node-SPARCKINA-07 duram um turno a mais. Sempre que ele causar dano, tem 50% de chance de aplicar "Paralisado" por 2 turnos (duração aumentada por sua passiva).`,
  onTurnStart({ target, context }) {
    const self = target;
    if (!self) return;

    const base = Number(self.Speed) || 0;
    const amount = Math.round((base * 0.1) / 5) * 5;
    if (amount <= 0) return;

    const result = self.modifyStat({
      statName: "Speed",
      amount,
      context,
      isPermanent: true,
    });

    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(self)} ganhou +${result?.appliedAmount ?? amount} VEL.`,
    };
  },

  afterDamageDealt({ attacker, target, damage, context, self }) {
    if (self !== attacker) return;
    if (damage <= 0) return;
    if (Math.random() > 0.5) return;

    target.applyKeyword("paralisado", 2, context, {
      sourceId: self.id,
      sourceName: self.name,
    });
    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(attacker)} aplicou "Paralisado" em ${formatChampionName(target)} por 2 turnos!`,
    };
  },
};
