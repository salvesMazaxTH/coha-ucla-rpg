const queimando = {
  key: "queimando",
  name: "Queimando",
  type: "debuff",
  subtypes: ["dot"],

  onTurnStart({ self, context }) {
    const damage = 20;

    self.takeDamage(damage, context);

    context.registerDamage({
      target: self,
      amount: damage,
      sourceId: null,
      isDot: true,
    });

    return {
      log: `${self.name} sofre dano de Queimadura.`,
    };
  },
};

export default queimando;
