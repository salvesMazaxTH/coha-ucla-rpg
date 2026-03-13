import { formatChampionName } from "../../ui/formatters.js";

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
    onAfterDmgDealing: "source",
    onAfterHealing: "source",
  },

  onAfterDmgDealing({ source, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.mareStacks = owner.runtime.mareStacks || 0;

    // cura
    const healed = owner.heal(this.healPerHit, context);

    console.log(`[NAELYS] ${formatChampionName(owner)} foi curado em ${healed} HP e ganhou 1 stack de Maré (${owner.runtime.mareStacks}/${this.maxStacks}).`);

    if (healed <= 0) return;

    return {
      log: `[Coração das Marés] ${formatChampionName(owner)} recuperou ${healed} HP e ganhou 1 stack de Maré (${owner.runtime.mareStacks}/${this.maxStacks}).`,
    };
  },

  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    // stack
    if (healSrc.id !== owner?.id) return;
    console.log("[NAELYS] Tentando aplicar stack de Maré...");
    
    if (owner.runtime.mareStacks < this.maxStacks) {
      owner.runtime.mareStacks++;
      console.log(`[NAELYS] ${owner} agora tem ${owner.runtime.mareStacks} stack(s) de Maré.`); 

      owner.addDamageModifier({
        id: `mare-stack-${owner.runtime.mareStacks}`,
        name: "Maré",
        permanent: true,

        apply: ({ baseDamage }) => {
          return baseDamage + this.dmgPerStack;
        },
      });
      console.log(`[NAELYS] damageMods: ${owner.getDamageModifiers()}`);
    }
  },
};
