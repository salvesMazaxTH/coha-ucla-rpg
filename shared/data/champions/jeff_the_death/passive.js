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
    });
  },
};
