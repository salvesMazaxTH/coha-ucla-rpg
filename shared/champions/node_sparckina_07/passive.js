import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Energia Pulsante",
  description: `Node-SPARCKINA-07 gera uma onda de energia a cada turno, aumentando sua velocidade em 10%. As paralisias aplicadas por Node-SPARCKINA-07 duram um turno a mais. Sempre que ele causar dano, tem 33% de chance de aplicar "Paralisado" por 2 turnos (duração aumentada por sua passiva).`,
  onTurnStart({ target, context }) {
    const self = target;
    if (!self) return;

    const result = self.modifyStat({
      statName: "Speed",
      amount: 10,
      context,
      isPermanent: true,
      isPercent: true,
    });

    if (result?.appliedAmount === 0) return;

    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(self)} ganhou +${result?.appliedAmount ?? amount} VEL.`,
    };
  },

  afterDamageDealt({ attacker, target, damage, context, self }) {
    if (self !== attacker) return;
    if (damage <= 0) return;

    const roll = Math.random();
    const success = roll < 0.3334; // 33% de chance de aplicar "Paralisado"

    if (!success) {
      console.log(
        `[PASSIVA — Energia Pulsante] Node-SPARCKINA-07 não rolou ${roll} para aplicar "Paralisado" e falhou.`,
      );
      return;
    }

    target.applyKeyword("paralisado", 2, context, {
      sourceId: self.id,
      sourceName: self.name,
    });

    console.log(
      `— [PASSIVA — Energia Pulsante] ${formatChampionName(attacker)} aplicou "Paralisado" em ${formatChampionName(target)} por 2 turnos. roll: ${roll}`,
    );

    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(attacker)} aplicou "Paralisado" em ${formatChampionName(target)} por 2 turnos!`,
    };
  },
};
