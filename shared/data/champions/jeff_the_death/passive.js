import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "a_morte_não_cessa",
  name: "A Morte Não Cessa",

  description() {
    return `Quando Jeff for derrotado, ele volta ao campo de batalha com 75% de sua vida máxima e os atributos base no início do próximo turno.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (defender.HP > 0) return;

    console.log("[Passiva - Jeff] A Morte Não Cessa ativada para", defender.id);
    console.log(
      `[Passiva - Jeff] Agendando revival para o próximo turno (Turno ${context.currentTurn + 1})`,
    );

    defender.runtime.deathCounter ??= 0;
    defender.runtime.deathCounter++;

    context.schedule({
      type: "spawnChampion",
      turnToHappen: context.currentTurn + 1,
      payload: {
        championKey: defender.championKey,
        team: defender.team,
        onSpawn: (champion, context) => {
          champion.HP = Math.floor(champion.maxHP * 0.75);
          // buff pela própria morte, já que onChampionDeath é pulado quando Jeff morre
          const buffsPerDeath = [
            { stat: "Attack", amount: 30, isPercent: true },
            { stat: "Defense", amount: 30, isPercent: true },
          ];
          buffsPerDeath.forEach((buff) => {
            champion.modifyStat({
              statName: buff.stat,
              amount: buff.amount,
              context,
              isPermanent: true,
              isPercent: buff.isPercent,
            });
          });
        },
      },
      dialog: {
        message: `[Passiva - <b>A Morte Não Cessa</b>] ${formatChampionName(defender)} retorna ao campo de batalha!`,
        sourceId: null,
        targetId: null,
        blocking: true,
      },
    });
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (owner === deadChampion) return; // buff da própria morte é tratado em onSpawn
    if (!owner.alive) return;
    // não incluí hookScope, porque quando qualquer um morre, ele se buffa
    console.log(
      `[Passiva - Jeff] Buffando Jeff pela morte de ${deadChampion?.name ?? "alguém"}.`,
    );
    const buffsPerDeath = [
      { stat: "Attack", amount: 30, isPercent: true },
      { stat: "Defense", amount: 30, isPercent: true },
    ];
    buffsPerDeath.forEach((buff) => {
      owner.modifyStat({
        statName: buff.stat,
        amount: buff.amount,
        context,
        isPermanent: true,
        isPercent: buff.isPercent,
      });
    });
  },
};
