// Centralização do Bloqueio Total (ranged global)
import { formatChampionName } from "../../ui/formatters.js";

const basicBlock = {
  key: "bloqueio_basico",
  name: "Bloqueio Total",
  priority: 5,
  effectDuration: 1,
  description() {
    return `\n Bloqueio Total genérico, físico e à distância. Anula totalmente o próximo dano recebido e todos os efeitos de status neste turno.`;
  },
  targetSpec: ["self"],
  resolve({ user, context = {} }) {
    user.runtime.hookEffects ??= [];
    user.runtime.basicBlockStreak ??= 0;

    // Progressão geométrica base 2: 100%, 50%, 25%, 12.5%, ...
    console.log(
      `[basicBlock debug] ${formatChampionName(user)} tem uma streak atual de ${user.runtime.basicBlockStreak}.`,
    );
    const streak = user.runtime.basicBlockStreak;
    const chance = 1 / Math.pow(2, streak);
    const roll = Math.random();
    console.log(
      `[basicBlock debug] streak: ${streak}, chance: ${(chance * 100).toFixed(1)}%, roll: ${roll}`,
    );
    const success = roll < chance;

    if (!success) {
      user.runtime.basicBlockStreak = 0;

      const failMessage = `${formatChampionName(user)} tentou usar <b>Bloqueio Total</b>, mas falhou.`;

      context.registerDialog?.({
        message: failMessage,
        sourceId: user.id,
        targetId: user.id,
      });

      return {
        log: failMessage,
      };
    }

    user.runtime.basicBlockStreak += 1;

    const effect = {
      key: "bloqueio_basico_effect",
      group: "skill",

      expiresAtTurn: context?.currentTurn + this.effectDuration,

      hookScope: {
        onDamageIncoming: "defender",
        onStatusEffectIncoming: "target",
      },

      onDamageIncoming({ defender }) {
        // remover depois de anular o primeiro dano
        user.runtime.hookEffects = user.runtime.hookEffects.filter(
          (e) => e.key !== "bloqueio_basico_effect",
        );
        return {
          cancel: true,
          immune: true,
          message: `${formatChampionName(defender)} bloqueou o ataque com <b>Bloqueio Total</b>!`,
        };
      },

      onStatusEffectIncoming({ target, statusEffect }) {
        if (statusEffect.type !== "debuff") return;
        return {
          cancel: true,
          message: `${formatChampionName(target)} bloqueou um efeito negativo com <b>Bloqueio Total</b>!`,
        };
      },

      onTurnEnd({ owner, context }) {
        if (context.currentTurn !== owner.runtime.lastBasicBlockTurn) {
          owner.runtime.basicBlockStreak = 0;
          console.log(
            `[basicBlock debug] ${owner.name} não usou Bloqueio Total neste turno. Basic Block Streak resetada.`,
          );
        }
      },
    };

    user.runtime.hookEffects.push(effect);
    user.runtime.lastBasicBlockTurn = context.currentTurn;

    return {
      message: `${formatChampionName(user)} usou <b>Bloqueio Total</b> e está protegido contra o próximo ataque!`,
    };
  },
};

export default basicBlock;
