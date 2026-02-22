import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Energia Pulsante",
  speedBuff: 10,
  paralyzeChance: 33,
  paralyzeDuration: 2,
  description() {
    return `Node-SPARCKINA-07 gera uma onda de energia a cada turno, aumentando sua velocidade em ${this.speedBuff}%. As paralisias aplicadas por Node-SPARCKINA-07 duram um turno a mais. Sempre que ele causar dano, tem ${this.paralyzeChance}% de chance de aplicar "Paralisado" por ${this.paralyzeDuration} turnos (duração aumentada por sua passiva).`;
  },
  onTurnStart({ self, context }) {
    if (!self) return;

    const result = self.modifyStat({
      statName: "Speed",
      amount: this.speedBuff,
      context,
      isPermanent: true,
      isPercent: true,
    });

    if (result?.appliedAmount === 0) return;

    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(self)} ganhou +${result?.appliedAmount ?? this.speedBuff} VEL.`,
    };
  },

  afterDamageDealt({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (owner?.id !== dmgSrc?.id) return;
    if (damage <= 0) return;

    const roll = Math.random();
    const success = roll < this.paralyzeChance / 100;

    if (!success) {
      console.log(
        `[PASSIVA — Energia Pulsante] Node-SPARCKINA-07 não rolou ${roll} para aplicar "Paralisado" e falhou.`,
      );
      return;
    }

    const paralyzed = dmgReceiver.applyKeyword(
      "paralisado",
      this.paralyzeDuration,
      context,
      {
        sourceId: owner.id,
        sourceName: owner.name,
      },
    );

    if (!paralyzed) {
      console.log(
        `[PASSIVA — Energia Pulsante] ${formatChampionName(dmgSrc)} tentou aplicar "Paralisado" em ${formatChampionName(dmgReceiver)}, mas falhou.`,
      );
      return;
    }

    console.log(
      `— [PASSIVA — Energia Pulsante] ${formatChampionName(dmgSrc)} aplicou "Paralisado" em ${formatChampionName(dmgReceiver)} por ${this.paralyzeDuration} turnos. roll: ${roll}`,
    );

    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(dmgSrc)} aplicou "Paralisado" em ${formatChampionName(dmgReceiver)} por ${this.paralyzeDuration} turnos!`,
    };
  },
};
