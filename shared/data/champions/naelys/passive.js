import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "coracao_das_mares",
  name: "Coração das Marés",

  healPerHit: 10,
  dmgPerStack: 10,
  maxStacks: 4,

  description(champion) {
    const stacks = champion?.runtime?.mareStacks || 0;

    return `Ao causar dano, cura ${this.healPerHit} HP. Cada cura concede 1 acúmulo de Maré.

    Cada stack concede +${this.dmgPerStack} de dano flat. Máx ${this.maxStacks} acúmulos. Os acúmulos são permanentes.

    Stacks atuais: ${stacks}/${this.maxStacks}
    Máximo bônus total: +${this.dmgPerStack * this.maxStacks} de dano.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onAfterHealing: "healSrc",
  },

  onAfterDmgDealing({ attacker, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.mareStacks = owner.runtime.mareStacks || 0;

    // cura
    const healed = owner.heal(this.healPerHit, context);

    if (healed <= 0) return;

    return {
      log: `[Coração das Marés] ${formatChampionName(owner)} recuperou ${healed} HP e ganhou 1 stack de Maré (${owner.runtime.mareStacks}/${this.maxStacks}).`,
    };
  },

  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    if (healSrc.id !== owner?.id) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.mareStacks = owner.runtime.mareStacks || 0;

    if (owner.runtime.mareStacks >= this.maxStacks) return;

    owner.runtime.mareStacks++;

    // Adiciona o modifier UMA vez, no primeiro stack (igual Naelthos faz na ult)
    const alreadyHas = owner
      .getDamageModifiers()
      .some((m) => m.id === "mare-stacks");

    if (!alreadyHas) {
      owner.addDamageModifier({
        id: "mare-stacks",
        name: "Maré",
        permanent: true,
        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.min(
            attacker.runtime?.mareStacks || 0,
            this.maxStacks,
          );
          return baseDamage + stacks * this.dmgPerStack;
        },
      });
    }
  },
};
