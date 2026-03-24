import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "energia_pulsante",
  name: "Energia Pulsante",
  speedBuff: 10,
  paralyzeChance: 20,
  paralyzeDuration: 2,
  description() {
    return `Node-SPARCKINA-07 gera uma onda de energia a cada turno, aumentando sua velocidade em ${this.speedBuff}%. As paralisias aplicadas por Node-SPARCKINA-07 duram um turno a mais. Sempre que ele causar dano, tem ${this.paralyzeChance}% de chance de aplicar {Paralisado} {paraliasdo} por ${this.paralyzeDuration} turnos (duração aumentada por sua passiva).`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onTurnStart({ owner, context }) {
    const result = owner.modifyStat({
      statName: "Speed",
      amount: this.speedBuff,
      context,
      isPermanent: true,
      isPercent: true,
    });

    if (result?.appliedAmount === 0) return;

    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(owner)} ganhou +${result?.appliedAmount ?? this.speedBuff} VEL.`,
    };
  },

  onAfterDmgDealing({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;

    const roll = Math.random();
    const success = roll < this.paralyzeChance / 100;

    if (!success) {
      /* console.log(
        `[PASSIVA — Energia Pulsante] Node-SPARCKINA-07 não rolou ${roll} para aplicar "Paralisado" e falhou.`,
      );
      */
      return;
    }

    const paralyzed = defender.applyStatusEffect(
      "paralisado",
      this.paralyzeDuration,
      context,
      {
        sourceId: owner.id,
        sourceName: owner.name,
      },
    );

    if (!paralyzed) {
      /* console.log(
        `[PASSIVA — Energia Pulsante] ${formatChampionName(attacker)} tentou aplicar "Paralisado" em ${formatChampionName(defender)}, mas falhou.`,
      );
      */
      return;
    }

    /* console.log(
      `— [PASSIVA — Energia Pulsante] ${formatChampionName(attacker)} aplicou "Paralisado" em ${formatChampionName(defender)} por ${this.paralyzeDuration} turnos. roll: ${roll}`,
    );
    */
    return {
      log: `[PASSIVA — Energia Pulsante] ${formatChampionName(attacker)} aplicou "Paralisado" em ${formatChampionName(defender)} por ${this.paralyzeDuration} turnos!`,
    };
  },
};
