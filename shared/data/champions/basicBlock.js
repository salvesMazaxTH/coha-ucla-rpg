// Centralização do Bloqueio Básico (ranged global)
import { formatChampionName } from "../../ui/formatters.js";

const basicBlock = {
  key: "bloqueio_basico",
  name: "Bloqueio Básico",
  priority: 5,
  effectDuration: 1,
  description() {
    return `\n Bloqueio básico genérico, físico e à distância. Anula totalmente o próximo dano recebido e todos os efeitos de status neste turno.`;
  },
  targetSpec: ["self"],
  resolve({ user, context = {} }) {
    user.runtime.hookEffects ??= [];

    const effect = {
      key: "bloqueio_basico_effect",
      group: "skill",
      form: "bola_agua",

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
          message: `${formatChampionName(defender)} bloqueou o ataque com Bloqueio Básico!`,
        };
      },

      onStatusEffectIncoming({ target, statusEffect }) {
        if (statusEffect.type !== "debuff") return;

        return {
          cancel: true,
          message: `${formatChampionName(target)} bloqueou um efeito negativo com Bloqueio Básico!`,
        };
      },

      onTurnStart({ owner, context }) {
        if (context.currentTurn > this.expiresAtTurn) {
          user.runtime.hookEffects = user.runtime.hookEffects.filter(
            (e) => e.key !== "bloqueio_basico_effect",
          );
        }
      },
    };

    user.runtime.hookEffects.push(effect);

    return {
      message: `${formatChampionName(user)} usou Bloqueio Básico e está protegido contra o próximo ataque!`,
    };
  },
};

export default basicBlock;
