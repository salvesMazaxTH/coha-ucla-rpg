export default {
  name: "passiva-blyskartri",
  maxPassiveStacks: 15,
  description() {
    return `Blyskartri restura 20 MP adicional no início de cada turno. Sempre que mana for restaurada a ele ou por ele, ganha 1 Acúmulo (Máx.: ${this.maxPassiveStacks}).`;
  },
  onTurnStart({ self, context }) {
    {
      self.addResource(20);
      const currentStacks = self.runtime?.passiveStacks || 0;
      if (currentStacks >= this.maxPassiveStacks) return;
    }
  },
  onResourceGain({ self, amount, context, resourceType, source }) {
    if (amount <= 0) return;

    if (resourceType !== "mana") return;

    if (self !== target && self !== source) 
        return; // Só ganha stack se ele ganhar ou conceder mana

    const currentStacks = self.runtime?.passiveStacks || 0;

    if (currentStacks >= this.maxPassiveStacks) return;

    self.runtime = self.runtime || {};
    self.runtime.passiveStacks = currentStacks + 1;
    return { log : `Blyskartri ganha 1 acúmulo de passiva (${self.runtime.passiveStacks}/${this.maxPassiveStacks})` }; 
  },
};
