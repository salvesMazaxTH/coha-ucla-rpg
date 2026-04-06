import { formatChampionName } from "../../../ui/formatters.js";

function _processResonance(owner, threshold, ultGain, context, resolver) {
  let procs = 0;

  while ((owner.runtime.ressonanceStacks || 0) >= threshold) {
    const ally = context.aliveChampions
      .filter((c) => c.team === owner.team && c.id !== owner.id)
      .sort((a, b) => a.ultMeter - b.ultMeter)[0];

    if (!ally) break;

    owner.runtime.ressonanceStacks -= threshold;

    if (resolver?.applyResourceChange) {
      resolver.applyResourceChange({
        target: ally,
        amount: ultGain,
        context,
        sourceId: owner.id,
      });
    } else {
      ally.addUlt(ultGain);
    }
    procs++;
  }

  return procs;
}

export default {
  key: "ressonancia_eryonica",
  name: "Ressonância Eryônica",
  stacksCap: 5,
  ultGain: 1,

  description(champion) {
    const stacks = champion.runtime.ressonanceStacks || 0;

    return `Sempre que um aliado ganha ou consome ultômetro, Eidolon acumula Ressonância.

    <b>Acúmulos atuais: ${stacks}</b>

    A cada ${this.stacksCap} unidades acumuladas, concede um quarto de barra de ultômetro ao aliado com menor ultômetro.`;
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain({ owner, target, amount, context, resolver }) {
    if (owner.team !== target.team) return;
    if (target.id === owner.id) return;
    if (amount <= 0) return;

    owner.runtime.ressonanceStacks ??= 0;
    owner.runtime.ressonanceStacks += amount;

    const procs = _processResonance(
      owner,
      this.stacksCap,
      this.ultGain,
      context,
      resolver,
    );

    if (procs > 0) {
      return {
        log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
          owner,
        )} converteu Ressonância ${procs}x. Acúmulos restantes: ${
          owner.runtime.ressonanceStacks
        }`,
      };
    }

    return {
      log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
        owner,
      )} acumulou ${amount} de Ressonância. Acúmulos atuais: ${
        owner.runtime.ressonanceStacks
      }`,
    };
  },

  onResourceSpend({ owner, target, amount, context, resolver }) {
    if (owner.team !== target.team) return;
    if (target.id === owner.id) return;
    if (amount <= 0) return;

    owner.runtime.ressonanceStacks ??= 0;
    owner.runtime.ressonanceStacks += amount;

    const procs = _processResonance(
      owner,
      this.stacksCap,
      this.ultGain,
      context,
      resolver,
    );

    if (procs > 0) {
      return {
        log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
          owner,
        )} converteu Ressonância ${procs}x. Acúmulos restantes: ${
          owner.runtime.ressonanceStacks
        }`,
      };
    }

    return {
      log: `<b>[PASSIVA — Ressonância Eryônica]</b> ${formatChampionName(
        owner,
      )} acumulou ${amount} de Ressonância. Acúmulos atuais: ${
        owner.runtime.ressonanceStacks
      }`,
    };
  },
};
