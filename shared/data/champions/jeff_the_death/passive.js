import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "a_morte_não_cessa",
  name: "A Morte Não Cessa",

  description(champion) {
    return `Quando Jeff for derrotado, ele volta ao campo de batalha com 75% de sua vida máxima e os atributos base no início do próximo turno. Sempre que um personagem morrer, Jeff ganha um buff permanente de 30% de ataque e 30% de defesa.
    
    <b>Contador de mortes de Jeff:</b> ${champion.runtime.deathCounter ?? 0}`;
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
        combatSlot: defender.combatSlot, // Garante o mesmo slot
        reviveFrom: defender, // Passa referência do Jeff antigo
        onSpawn: (champion, context, reviveFrom) => {
          // Copia todos os dados relevantes do Jeff antigo para o novo
          if (reviveFrom) {
            // runtime (deep clone exceto currentContext)
            champion.runtime = { ...reviveFrom.runtime };
            delete champion.runtime.currentContext;
            // statModifiers
            champion.statModifiers = reviveFrom.statModifiers
              ? reviveFrom.statModifiers.map((m) => ({ ...m }))
              : [];
            // damageModifiers
            champion.damageModifiers = reviveFrom.damageModifiers
              ? reviveFrom.damageModifiers.map((m) => ({ ...m }))
              : [];
            // damageReductionModifiers
            champion.damageReductionModifiers =
              reviveFrom.damageReductionModifiers
                ? reviveFrom.damageReductionModifiers.map((m) => ({ ...m }))
                : [];
            // statusEffects (Map deep copy)
            if (reviveFrom.statusEffects instanceof Map) {
              champion.statusEffects = new Map();
              for (const [k, v] of reviveFrom.statusEffects.entries()) {
                champion.statusEffects.set(k, { ...v });
              }
            }
          }
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
