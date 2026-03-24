export default {
  name: "Presságio Glacial",
  chillDuration: 2,
  freezeDuration: 1,
  description() {
    return `Sempre que Nythera sofrer dano que cause contato (exceto dano absoluto): o agressor recebe ❄️ Gelado.

    Se já estiver Gelado: → torna-se Congelado.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, skill, damage, context }) {
    if (damage <= 0 || attacker.team === owner.team) return;

    if (!skill.contact) return;

    // não empilhar com o efeito da skill, que faz o mesmo, mas melhor
    if (
      owner.runtime?.hookEffects?.some(
        (effect) => effect.key === "camara_de_estase",
      )
    ) {
      console.log(
        `[PASSIVA — Presságio Glacial] ${formatChampionName(owner)} já tem um efeito de gancho que aplica "Congelado". Ignorando aplicação adicional.`,
      );
      return;
    }

    const alreadyFrozen = attacker.hasStatusEffect("congelado");
    const alreadyChilled = attacker.hasStatusEffect("gelado");

    if (alreadyFrozen) return;
    if (alreadyChilled) {
      attacker.applyStatusEffect("congelado", this.freezeDuration, context);
    } else {
      attacker.applyStatusEffect("gelado", this.chillDuration, context);
    }
  },
};
