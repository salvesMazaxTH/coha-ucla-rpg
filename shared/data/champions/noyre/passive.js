import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";

function _processEntropy(owner, context, resolver, stacksCap = 7) {
  let procs = 0;

  while ((owner.runtime.entropyStacks || 0) >= stacksCap) {
    owner.runtime.entropyStacks -= stacksCap;
    procs++;

    const enemies = context.aliveChampions.filter((c) => c.team !== owner.team);

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // 🔹 checar se tinha ult suficiente pra ultar (ANTES de drenar)
      const canUlt =
        enemy.skills?.some((s) => s.isUltimate) &&
        enemy.ultMeter >=
          enemy.getSkillCost?.(enemy.skills.find((s) => s.isUltimate));

      // 🔹 drenar 1 unidade
      let drained = 0;

      if (resolver?.applyResourceChange) {
        const applied = resolver.applyResourceChange({
          target: enemy,
          amount: -1,
          context,
          sourceId: owner.id,
          emitHooks: false,
          visualPhase: "entropy_drain",
          debugLabel: "noyre_entropy_drain",
        });

        drained = Math.abs(applied || 0);
      } else {
        const applied = enemy.spendUlt(1);
        drained = Math.abs(applied || 0);
      }

      // Dialog animado ao consumir stacks (imitando Blyskartri, com prefixo padrão)
      if (drained > 0 && context?.registerDialog) {
        context.registerDialog({
          message: `<b>[Passiva — Entropia]</b> ${formatChampionName(owner)} drenou o ultômetro de ${formatChampionName(enemy)}!`,
          sourceId: owner.id,
          targetId: enemy.id,
        });
      }

      // 🔥 punição
      if (canUlt) {
        const dmg = Math.floor(enemy.maxHP * 0.15);

        new DamageEvent({
          baseDamage: dmg,
          attacker: owner,
          defender: enemy,
          context,
          allChampions: context.allChampions,
          mode: "piercing",
          piercingPercentage: 75,
        }).execute();
      }
    }
  }

  return procs;
}

function _accumulateEntropy(owner) {
  owner.runtime.entropyStacks ??= 0;
  owner.runtime.entropyStacks += 1;
}

export default {
  key: "entropia_noyre",
  name: "Entropia Entrópica",
  stacksCap: 7,

  description(champion) {
    const stacks = champion.runtime.entropyStacks || 0;

    return `Sempre que um inimigo ganha ou consome ultômetro, Noyre acumula 1 Entropia.

    <b>Acúmulos atuais: ${stacks}</b>

    A cada ${this.stacksCap} acúmulos, remove 1 unidade de ultômetro de todos os inimigos. Inimigos que tinham ult suficiente para usar sua ultimate sofrem 15% do HP máximo como Dano Perfurante.`;
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain({ owner, target, amount, context, resolver }) {
    if (owner.team === target.team) return;
    if (amount <= 0) return;

    _accumulateEntropy(owner);

    const procs = _processEntropy(owner, context, resolver, this.stacksCap);

    if (procs > 0) {
      return {
        log: `<b>[PASSIVA — Entropia]</b> ${formatChampionName(
          owner,
        )} desencadeou Entropia ${procs}x.`,
      };
    }
  },

  onResourceSpend({ owner, target, amount, context, resolver }) {
    if (owner.team === target.team) return;
    if (amount <= 0) return;

    _accumulateEntropy(owner);

    const procs = _processEntropy(owner, context, resolver, this.stacksCap);

    if (procs > 0) {
      return {
        log: `<b>[PASSIVA — Entropia]</b> ${formatChampionName(
          owner,
        )} desencadeou Entropia ${procs}x.`,
      };
    }
  },
};
