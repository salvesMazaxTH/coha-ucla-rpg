import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "a_morte_não_cessa",
  name: "A Morte Não Cessa",

  description() {
    return `Quando Jeff for derrotado, ele volta ao campo de batalha com 75% de sua vida máxima e os atributos base no início do próximo turno.`;
  },

  hookScope: {
    onAfterDmgTaking: "target",
  },

  onAfterDmgTaking({ source, target, owner, damage, context }) {
    if (target !== owner) return;
    if (target.HP > 0) return;

    console.log("[Passiva - Jeff] A Morte Não Cessa ativada para", target.id);
    console.log(
      `[Passiva - Jeff] Agendando revival para o próximo turno (Turno ${context.currentTurn + 1})`,
    );

    context.schedule({
      type: "spawnChampion",
      turnToHappen: context.currentTurn + 1,
      payload: {
        championKey: target.championKey,
        team: target.team,
      },
      dialog: {
        message: `[Passiva - <b>A Morte Não Cessa</b>] ${formatChampionName(target)} retorna ao campo de batalha!`,
        sourceId: null,
        targetId: null,
        blocking: true,
      },
    });
  },

  onAfterDeath({ owner }) {
    // não incluí hookScope, porque quando qualquer um morre, ele se buffa
    console.log("[Passiva - Jeff] Buffando Jeff por morte de um aliado, inimigo ou de si mesmo.");
    const buffsPerDeath = [
      { stat: "Attack", amount: 30, isPercent: true },
      { stat: "Defense", amount: 30, isPercent: true },
    ];
    console.log(`[Passiva - Jeff] Buffs a serem aplicados:`, buffsPerDeath);
    buffsPerDeath.forEach((buff) => {
      console.log(`[Passiva - Jeff] Aplicando buff: +${buff.amount}${buff.isPercent ? "%" : ""} ${buff.stat} a Jeff (ID: ${owner.id})`);
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
