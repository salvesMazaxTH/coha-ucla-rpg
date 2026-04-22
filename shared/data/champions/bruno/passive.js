import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "frio_absoluto",
  name: "Frio Absoluto",
  passiveDamage: 45,
  lowLifeThresholdRatio: 0.3,
  forcedCritBonus: 55,

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onStatusEffectIncoming: undefined,
  },

  onBeforeDmgDealing({ attacker, owner, defender, crit, damage }) {
    if (attacker !== owner) return;
    if (!defender?.maxHP) return;

    const lowLifeThreshold = Math.ceil(
      defender.maxHP * this.lowLifeThresholdRatio,
    );
    const isLowHP = defender.HP <= lowLifeThreshold;

    if (!isLowHP) return;

    const bonus = Number(crit?.bonus || this.forcedCritBonus);
    const critBonusFactor = bonus / 100;

    return {
      crit: {
        ...(crit || {}),
        didCrit: true,
        forced: true,
        disabled: false,
        bonus,
        critBonusFactor,
        critExtra: damage * critBonusFactor,
      },
    };
  },

  description() {
    return `Se o alvo tiver 30% do HP máximo ou menos, os ataques de Bruno sempre são um Acerto Crítico.\n\nQuando um campeão inimigo for Congelado, Bruno causa ${this.passiveDamage} de dano absoluto a ele.`;
  },

  onStatusEffectIncoming({ target, statusEffect, context, owner }) {
    if (statusEffect.key !== "frozen") return;
    if (target.team === owner.team) return;
    if (!owner.alive) return;
    if (target.hasStatusEffect?.("frozen")) return;
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
      type: "magical",
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
      allChampions: context.allChampions,
    }).execute();
  },
};
