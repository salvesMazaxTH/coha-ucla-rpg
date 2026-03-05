export default {
  name: "Presságio Glacial",
  chillDuration: 2,
  freezeDuration: 1,
  description() {
    return `Sempre que Nythera sofrer dano (exceto dano absoluto): o agressor recebe ❄️ {Gelado}.

    Se já estiver {Gelado}: → torna-se {Congelado}.`;
  },
  hookScope: {
    onAfterDmgTaking: "self",
  },
  onAfterDmgTaking({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (damage <= 0 || dmgSrc.team === owner.team) return;

    const alreadyFrozen = dmgSrc.hasKeyword("congelado");
    const alreadyChilled = dmgSrc.hasKeyword("gelado");

    if (alreadyFrozen) return;
    if (alreadyChilled) {
      dmgSrc.applyKeyword("congelado", this.freezeDuration, context);
    } else {
      dmgSrc.applyKeyword("gelado", this.chillDuration, context);
    }
  },
};
