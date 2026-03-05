export default {
  name: "passiva-blyskartri",
  maxPassiveStacks: 15,
  description() {
    return `Blyskartri restura 20 MP adicional no início de cada turno. Sempre que mana for restaurada a ele ou por ele, ganha 1 Acúmulo (Máx.: ${this.maxPassiveStacks}).`;
  },

  hookScope: {
    onResourceGain: "sourceOrTarget",
  },

  onTurnStart({ owner, context }) {
    {
      owner.addResource(20);
      const currentStacks = owner.runtime?.passiveStacks || 0;
      if (currentStacks >= this.maxPassiveStacks) return;
    }
  },

  onResourceGain({ owner, amount, context, resourceType, source }) {
    if (amount <= 0) return;

    if (resourceType !== "mana") return;

    const currentStacks = owner.runtime?.passiveStacks || 0;

    if (currentStacks >= this.maxPassiveStacks) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.passiveStacks = currentStacks + 1;
    return {
      log: `Blyskartri ganha 1 acúmulo de passiva (${owner.runtime.passiveStacks}/${this.maxPassiveStacks})`,
    };
  },
};
