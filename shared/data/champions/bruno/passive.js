import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "frio_absoluto",
  name: "Frio Absoluto",
  passiveDamage: 45,

  description() {
    return `Se o alvo tiver 30% do HP máximo ou menos, os ataques de Bruno sempre são um Acerto Crítico.

    Quando um campeão inimigo for Congelado, Bruno causa ${this.passiveDamage} de dano absoluto a ele.`;
  },

  hookScope: {
    onStatusEffectIncoming: undefined,
  },

  onStatusEffectIncoming({ target, statusEffect, context, owner }) {
    if (statusEffect.key !== "congelado") return;
    if (target.team === owner.team) return;
    if (!owner.alive) return;
    if (target.hasStatusEffect?.("congelado")) return;
    if (!context?.allChampions) return;

    context.registerDialog?.({
      message: `${formatChampionName(owner)} ativou <b>Frio Absoluto</b> e causou ${this.passiveDamage} de dano absoluto em ${formatChampionName(target)}!`,
      sourceId: owner.id,
      targetId: target.id,
    });

    new DamageEvent({
      mode: DamageEvent.Modes.ABSOLUTE,
      baseDamage: this.passiveDamage,
      attacker: owner,
      defender: target,
      skill: {
        key: "frio_absoluto_passiva",
        name: "Frio Absoluto (Passiva)",
        contact: false,
      },
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
      allChampions: context.allChampions,
    }).execute();
  },
};
