import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Punhos em Combustão",
  flamingFistsDamage: 20,
  burnDuration: 1,
  description() {
    return `Sempre que Kai causa dano com um Ataque Básico, ele aplica um impacto térmico adicional:
        - O impacto térmico causa ${this.flamingFistsDamage}dano direto.
        Aplicação de Estado:
        Se o alvo não tiver Afinidade: Terra, Água ou Fogo:
        → O alvo fica "Queimando".`;
  },
  afterDamageDealt({ attacker, target, damage, self, context }) {
    if (damage <= 0) return; // Só ativa se causar dano
    const basicAttack = context?.skill?.key === "ataque_basico";
    if (!basicAttack) return; // Só ativa em Ataques Básicos

    // Aplica o impacto térmico
    const impactDamage = self.flamingFistsDamage;

    const result = CombatResolver.resolveDamage({
      mode: "direct",
      baseDamage: impactDamage,
      directDamage: damage,
      user: attacker,
      target,
      skill: {
        key: "flaming_fists_bonus",
        name: self.name,
      },
      context,
      allChampions: context?.allChampions || [],
    });

    if (result.damageDealt > 0) {
      // Verifica afinidade do alvo (ainda não implementado, então é apenas um comentário para referência futura)
      /* const hasAffinity = target.affinities?.some((aff) =>
        ["terra", "agua", "fogo"].includes(aff) */
      // );
      target.applyKeyword("queimando", this.burnDuration, context, {
        source: self.name,
      });
    }

    return {
      log: `${formatChampionName(attacker)} aplica ${impactDamage} de dano térmico a ${formatChampionName(target)} com ${self}.`,
    };
  },
};
