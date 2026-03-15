const queimando = {
  key: "queimando",
  name: "Queimando",
  type: "debuff",
  subtypes: ["dot", "fire"],

  onTurnStart({ owner, context }) {
    const damage = 20;

    owner.takeDamage(damage, context);

    context.registerDamage({
      target: owner,
      amount: damage,
      sourceId: null,
      isDot: true,
    });

    return {
      log: `${owner.name} sofre dano de Queimadura.`,
    };
  },
};

export default queimando;
