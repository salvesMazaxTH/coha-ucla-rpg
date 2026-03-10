import { formatChampionName } from "../../ui/formatters.js";

export default {
  key: "impulso_crescente",
  name: "Impulso Crescente",

  speedPerTurn: 5,
  speedCap: 25,

  stackCap: 10,

  description() {
    return `No início de cada turno, Blyskartri ganha +${this.speedPerTurn} Velocidade (máx. +${this.speedCap} acumulado).
    Sempre que Blyskartri ou um aliado ganhar Velocidade ou ativar Esquiva, Blyskartri ganha 1 Acúmulo (máx. ${this.stackCap}).
    Ao atingir ${this.stackCap}, consome todos os acúmulos e concede +1 barra de Ultômetro ao aliado com menor HP atual (máx. 1 vez por turno).`;
  },

  hookScope: {
    onTurnStart: "self",
    onStatGain: "ally",
    onEvade: "ally",
  },

  onTurnStart({ owner, context }) {

    owner.runtime ??= {};
    owner.runtime.impulsoSpeed ??= 0;
    owner.runtime.impulsoStacks ??= 0;

    owner.runtime.impulsoTriggeredTurn = false;

    if (owner.runtime.impulsoSpeed >= this.speedCap) return;

    const gain = Math.min(
      this.speedPerTurn,
      this.speedCap - owner.runtime.impulsoSpeed
    );

    owner.runtime.impulsoSpeed += gain;

    console.log("[BLYSKARTRI][PASSIVE] Speed gain", {
      gain,
      total: owner.runtime.impulsoSpeed
    });

    owner.modifyStat({
      statName: "Speed",
      amount: gain,
      context
    });

  },

  onStatGain({ owner, statName, source, context }) {

    if (statName !== "Speed") return;

    this._addStack(owner, context, "speed_gain");

  },

  onEvade({ owner, context }) {

    const damageEvent = context.visual?.damageEvents
      ?.filter(e => e.targetId === owner.id)
      .at(-1);

    if (!damageEvent?.evaded) return;

    this._addStack(owner, context, "evade");

  },

  _addStack(owner, context, reason) {

    owner.runtime ??= {};
    owner.runtime.impulsoStacks ??= 0;

    if (owner.runtime.impulsoStacks >= this.stackCap) return;

    owner.runtime.impulsoStacks++;

    console.log("[BLYSKARTRI][PASSIVE] stack gained", {
      stacks: owner.runtime.impulsoStacks,
      reason
    });

    if (owner.runtime.impulsoStacks < this.stackCap) return;

    if (owner.runtime.impulsoTriggeredTurn) return;

    const allies = context.allChampions.filter(
      c => c.team === owner.team && c.HP > 0
    );

    if (!allies.length) return;

    const lowest = allies.reduce((a, b) =>
      (a.HP / a.maxHP) < (b.HP / b.maxHP) ? a : b
    );

    console.log("[BLYSKARTRI][PASSIVE] STACK CAP REACHED → granting ult", {
      target: lowest.name
    });

    lowest.addUlt({
      amount: 1,
      context
    });

    owner.runtime.impulsoStacks = 0;
    owner.runtime.impulsoTriggeredTurn = true;

  }

};