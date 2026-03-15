export default {
  key: "coracao_vulcanico",
  name: "Coração Vulcânico",

  burnDuration: 2,

  description() {
    return `Sempre que Kael'Drath receber dano, o agressor é envolvido em chamas e recebe "Queimando" por ${this.burnDuration} turnos.`;
  },

  hookScope: {
    onAfterDmgTaking: "target",
  },

  onAfterDmgTaking({ source, target, owner, damage, context }) {
    if (damage <= 0) return;
    // não aplica em si mesmo
    if (target.id === owner?.id) return;

    source.applyStatusEffect("queimando", this.burnDuration, context);
  },
};
