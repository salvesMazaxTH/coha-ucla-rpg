import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "Presságio Glacial",
  chillDuration: 2,
  freezeDuration: 2,
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

    const alreadyFrozen = attacker.hasStatusEffect("frozen");
    const alreadyChilled = attacker.hasStatusEffect("chilled");

    if (alreadyFrozen) return;
    if (alreadyChilled) {
      attacker.applyStatusEffect("frozen", this.freezeDuration, context);
    } else {
      attacker.applyStatusEffect("chilled", this.chillDuration, context);
    }
  },
};
