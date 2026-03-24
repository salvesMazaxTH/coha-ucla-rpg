export default {
  key: "coracao_vulcanico",
  name: "Coração Vulcânico",

  burnDuration: 2,

  description() {
    return `Sempre que Kael'Drath receber dano, o agressor é envolvido em chamas e recebe "Queimando" por ${this.burnDuration} turnos.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;
    // não aplica em si mesmo
    if (defender.id === owner?.id) return;

    attacker.applyStatusEffect("queimando", this.burnDuration, context);
  },
};
