export default {
  name: "Presságio Glacial",
  chillDuration: 2,
  freezeDuration: 1,
  description() {
    return `Sempre que Nythera sofrer dano que cause contato (exceto dano absoluto): o agressor recebe ❄️ Gelado.

    Se já estiver Gelado: → torna-se Congelado.`;
  },
  
  hookScope: {
    onAfterDmgTaking: "target",
  },

  onAfterDmgTaking({ source, target, owner, skill, damage, context }) {
    if (damage <= 0 || source.team === owner.team) return;

    if (!skill.contact) return;

    // não empilhar com o efeito da skill, que faz o mesmo, mas melhor
    if (owner.runtime?.hookEffects?.some(effect => effect.key === "camara_de_estase")) {
      console.log(`[PASSIVA — Presságio Glacial] ${formatChampionName(owner)} já tem um efeito de gancho que aplica "Congelado". Ignorando aplicação adicional.`);
      return;
    }

    const alreadyFrozen = source.hasStatusEffect("congelado");
    const alreadyChilled = source.hasStatusEffect("gelado");

    if (alreadyFrozen) return;
    if (alreadyChilled) {
      source.applyStatusEffect("congelado", this.freezeDuration, context);
    } else {
      source.applyStatusEffect("gelado", this.chillDuration, context);
    }
  },
};
