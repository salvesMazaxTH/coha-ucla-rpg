import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "progressao_irrefreavel",
  name: "Progressão Irrefreável",
  stackCap: 8,
  speedPercentAsDamage: 0.85,

  description(champion) {
    return `Sempre que Blyskartri ou um aliado ganhar Velocidade ou Esquiva, Blyskartri ganha 1 Acúmulo; se Esquivar um ataque, ganha 1 Acúmulo adicional (máx. ${this.stackCap}).

    Acúmulos atuais: <b>${champion.runtime?.impulsoStacks ?? 0}</b>

    Ao atingir ${this.stackCap}, consome todos os acúmulos e causa imediatamente dano híbrido (50%) equivalente a ${this.speedPercentAsDamage * 100}% da Velocidade do personagem aliado mais rápido ao inimigo com menor vida.`;
  },

  hookScope: {
    onBuffingStat: undefined,
    onEvade: undefined,
  },

  onBuffingStat({ owner, statName, buffSrc, buffTarget, context }) {
    if (!buffSrc || buffSrc.team !== owner.team) return;
    if (!buffTarget || buffTarget.team !== owner.team) return;

    if (statName !== "Speed" && statName !== "Evasion") return;

    const stackResult = this._addStack({
      owner,
      context,
      reason: `${statName.toLowerCase()}_gain`,
    });

    if (stackResult?.log) return stackResult;

    return {
      log: `${formatChampionName(owner)} ganhou 1 Acúmulo de Impulso. Acúmulos totais atuais: ${owner.runtime.impulsoStacks}`,
    };
  },

  onEvade({ owner, defender, context }) {
    if (!defender || defender.team !== owner.team) return;

    const stackResult = this._addStack({ owner, context, reason: "evade" });

    if (stackResult?.log) return stackResult;

    return {
      log: `${formatChampionName(owner)} ganhou 1 Acúmulo de Impulso. Acúmulos totais atuais: ${owner.runtime.impulsoStacks}`,
    };
  },

  _addStack({ owner, context, reason }) {
    owner.runtime ??= {};
    owner.runtime.impulsoStacks ??= 0;

    if (owner.runtime.impulsoStacks >= this.stackCap) return;

    owner.runtime.impulsoStacks++;

    console.log("[BLYSKARTRI][PASSIVE] stack gained", {
      stacks: owner.runtime.impulsoStacks,
      reason,
    });

    if (owner.runtime.impulsoStacks < this.stackCap) return;

    const allies = context.aliveChampions.filter((c) => c.team === owner.team);

    if (!allies.length) return;

    const fastestAlly = allies.reduce((a, b) => (a.Speed > b.Speed ? a : b));

    console.log(
      "[BLYSKARTRI][PASSIVE] STACK CAP REACHED → dealing damage to 'target' based on 'fastestAlly': ",
      {
        fastestAlly: formatChampionName(fastestAlly),
        allies: allies.map((a) => formatChampionName(a)),
      },
    );

    const damageAmount = Math.floor(
      fastestAlly.Speed * this.speedPercentAsDamage,
    );

    const enemies =
      context?.allChampions instanceof Map
        ? [...context.allChampions.values()].filter(
            (c) => c.team !== owner.team && c.HP > 0,
          )
        : [];

    const lowestHealthEnemy = enemies.reduce((a, b) => {
      if (a.HP < b.HP) return a;
      if (b.HP < a.HP) return b;

      // empate → aleatório
      return Math.random() < 0.5 ? a : b;
    }, enemies[0]);

    console.log(
      "[BLYSKARTRI][PASSIVE] lowest health enemy selected as target: ",
      {
        lowestHealthEnemy: formatChampionName(lowestHealthEnemy),
        enemies: enemies.map((e) => formatChampionName(e)),
      },
    );

    context.registerDialog({
      message: `${formatChampionName(owner)} explodiu em velocidade e descarregou os acúmulos sobre ${formatChampionName(lowestHealthEnemy)}!`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    const damageEvent = new DamageEvent({
      baseDamage: damageAmount,
      attacker: owner,
      defender: lowestHealthEnemy,
      mode: DamageEvent.Modes.PIERCING,
      piercingPercentage: 50, // Ignora 50% da defesa do alvo
      skill: {
        key: "progressao_irrefreavel_explosion",
        contact: false,
      },
      type: "magical",
      context,
      allChampions: context?.allChampions,
    }).execute();

    owner.runtime.impulsoStacks = 0;

    return {
      damageEvent,
      log: `${formatChampionName(owner)} explodiu em velocidade e descarregou os acúmulos sobre ${formatChampionName(lowestHealthEnemy)}!`,
    };
  },
};
