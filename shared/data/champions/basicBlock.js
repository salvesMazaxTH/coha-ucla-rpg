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
    user.runtime.basicBlockStreak ??= 0;

    // Progressão geométrica base 2: 100%, 50%, 25%, 12.5%, ...
    const chance = 1 / Math.pow(2, user.runtime.basicBlockStreak);
    const success = Math.random() < chance;

    if (!success) {
      user.runtime.basicBlockStreak = 0;
      return {
        message: `${formatChampionName(user)} tentou usar Bloqueio Básico, mas falhou! (chance: ${(chance * 100).toFixed(1)}%)`,
      };
    }

    user.runtime.basicBlockStreak += 1;

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
        // Reset streak ao tomar dano (ou seja, ao usar outra ação)
        user.runtime.basicBlockStreak = 0;
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
      message: `${formatChampionName(user)} usou Bloqueio Básico e está protegido contra o próximo ataque! (chance: ${(chance * 100).toFixed(1)}%)`,
    };
  },
};

export default basicBlock;
