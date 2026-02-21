import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Punhos em Combustão",
  flamingFistsDamage: 20,
  burnDuration: 1,
  description() {
    return `Sempre que Kai causa dano com um Ataque Básico, ele aplica um impacto térmico adicional:
        - O impacto térmico causa ${this.flamingFistsDamage} de Dano Direto.
        Aplicação de Estado:
        Se o alvo não tiver Afinidade: Terra, Água ou Fogo:
        → O alvo fica "Queimando".`;
  },
  afterDamageDealt({ dmgSource, dmgTarget, damage, skill, context, owner }) {
    console.log("Skill dentro da passiva:", skill);

    if (owner.id !== dmgSource.id) return;
    if (!skill) return;
    if (skill.key !== "ataque_basico") return;
    if (damage <= 0) return;

    const impactDamage = this.flamingFistsDamage;

    const result = CombatResolver.resolveDamage({
      mode: "direct",
      baseDamage: impactDamage,
      user: dmgSource,
      target: dmgTarget,
      skill: {
        key: "flaming_fists_bonus",
        name: this.name,
      },
      context,
      allChampions: context?.allChampions,
    });

    if (result.totalDamage > 0) {
      dmgTarget.applyKeyword("queimando", owner.burnDuration, context, {
        source: owner.name,
      });
    }

    return {
      log: `${formatChampionName(owner)} aplica ${impactDamage} de dano térmico a ${formatChampionName(dmgTarget)} com ${owner.name}.`,
    };
  },
};
