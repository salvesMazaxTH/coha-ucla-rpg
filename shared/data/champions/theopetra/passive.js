import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "rocha_eternizada",
  name: "Rocha Eternizada",
  maxStacks: 3,
  bonusPercent: 135, // bônus de dano na próxima habilidade
  piercingRatio: 0.35, // 35% do dano se torna perfurante
  description() {
    return `Ganha 1 stack ao tomar dano (máx ${this.maxStacks}). Ao atingir ${this.maxStacks} stacks, a próxima habilidade causa +${this.bonusPercent}% de dano e se torna perfurante (${this.piercingRatio * 100}% de perfuração) e os stacks são zerados.\nTheópetra é imune a efeitos de Controle (softCC e hardCC).`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
    onStatusEffectIncoming: "target",
  },

  onAfterDmgTaking({ owner, context }) {
    owner.runtime = owner.runtime || {};
    owner.runtime.theopetraStacks = Math.min(
      (owner.runtime.theopetraStacks || 0) + 1,
      this.maxStacks,
    );
    if (owner.runtime.theopetraStacks === this.maxStacks) {
      context.registerDialog({
        message: `<b>[PASSIVA — ${this.name}]</b> ${formatChampionName(owner)} atingiu o máximo de stacks (${this.maxStacks})! A próxima habilidade terá bônus de dano.`,
        sourceId: owner.id,
        targetId: owner.id,
      });
      return {
        log: `<b>[PASSIVA — ${this.name}]</b> ${formatChampionName(owner)} atingiu o máximo de stacks (${this.maxStacks})! A próxima habilidade terá bônus de dano.`,
      };
    } else {
      return {
        log: `<b>[PASSIVA — ${this.name}]</b> ${formatChampionName(owner)} ganhou 1 stack (${owner.runtime.theopetraStacks}/${this.maxStacks}).`,
      };
    }
  },

  onBeforeDmgDealing({ attacker, owner, skill, damage, context }) {
    if (attacker !== owner) return;
    if (
      !owner.runtime?.theopetraStacks ||
      owner.runtime.theopetraStacks < this.maxStacks
    )
      return;
    owner.runtime.theopetraStacks = 0;

    const bonus = Math.floor(damage * (this.bonusPercent / 100));

    const finalBaseDamage = damage + bonus;

    return {
      damage: finalBaseDamage,
      piercingPercentage: this.piercingRatio * 100,
      mode: "piercing",
      baseDamage: finalBaseDamage,
      preMitigationDamage: finalBaseDamage,
      log: `[PASSIVA — Rocha Eternizada] ${formatChampionName(owner)} consome os stacks e recebe +${this.bonusPercent}% de dano nesta habilidade!`,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (!statusEffect?.subtypes) return;
    if (
      statusEffect.subtypes.includes("hardCC") ||
      statusEffect.subtypes.includes("softCC")
    ) {
      return {
        cancel: true,
        message: `${formatChampionName(target)} é imune a efeitos de Controle!`,
      };
    }
  },
};
