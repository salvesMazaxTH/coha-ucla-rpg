import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

// Reduz velocidade e ataque a 0 e impede de agir por X turno(s) (X geralmente 1)
const congelado = {
  key: "congelado",
  name: "Congelado",
  type: "debuff",
  subtypes: ["hardCC", "ice"],

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
    owner.modifyStat({
      statName: "Attack",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });
    return {
      message: `${owner.name} foi Congelado!`,
    };
  },

  hookScope: {
    onValidateAction: "actionSource",
    onAfterDmgTaking: "defender",
  },

  onValidateAction({ actionSource }) {
    return {
      deny: true,
      message: `${formatChampionName(actionSource)} está Congelado e não pode agir!`,
    };
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;
    // Só remove se o status já estava presente antes do dano (evita remover logo após aplicar)
    // Busca o status atual e verifica se o turno de expiração é maior que o turno atual
    const currentTurn = context?.currentTurn ?? 0;
    const effect =
      defender.getStatusEffect?.("congelado") ||
      defender.statusEffects?.get?.("congelado");
    if (effect && effect.appliedAtTurn < currentTurn) {
      defender.removeStatusEffect("congelado");
      return {
        log: `${formatChampionName(defender)} foi descongelado após receber dano!`,
      };
    }
    // Se acabou de ser aplicado neste turno, não remove
    return;
  },

  createInstance({ owner, duration, context, metadata }) {
    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
        hookScope: this.hookScope,
        onStatusEffectAdded: this.onStatusEffectAdded,
        onValidateAction: this.onValidateAction,
        onAfterDmgTaking: this.onAfterDmgTaking,
      },
    });
  },
};

export default congelado;
