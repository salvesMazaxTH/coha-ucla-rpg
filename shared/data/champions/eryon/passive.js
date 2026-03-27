import { formatChampionName } from "../../../ui/formatters.js";

function _processResonance(owner, threshold, ultGain, context) {
  let procs = 0;

  while ((owner.runtime.ressonanceStacks || 0) >= threshold) {
    const ally = context.aliveChampions
      .filter((c) => c.team === owner.team && c.id !== owner.id)
      .sort((a, b) => a.ultMeter - b.ultMeter)[0];

    if (!ally) break;

    owner.runtime.ressonanceStacks -= threshold;

    ally.addUlt({ amount: ultGain, context });
    procs++;
  }

  return procs;
}

export default {
  key: "ressonancia_eryonica",
  name: "Ressonância Eryônica",
  stacksCap: 4,
  ultGain: 1,

  description(champion) {
    const stacks = champion.runtime.ressonanceStacks || 0;

    return `Sempre que um aliado ganha ou consome ultômetro, Eidolon acumula Ressonância.

    Acúmulos atuais: ${stacks}

    A cada ${this.stacksCap} unidades acumuladas, concede ${this.ultGain} de ult ao aliado com menor ultômetro.`;
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain({ owner, target, amount, context }) {
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

  onResourceSpend({ owner, target, amount, context }) {
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
