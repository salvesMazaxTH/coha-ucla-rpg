import { DamageEvent } from "../../engine/DamageEvent.js";
import { formatChampionName } from "../../ui/formatters.js";

export default {
  name: "Punhos em Combustão",
  flamingFistsDamage: 20,
  burnDuration: 1,

  description() {
    return `Sempre que Kai causa dano com um Ataque Básico, ele aplica um impacto térmico adicional:
        - O impacto térmico causa ${this.flamingFistsDamage} de dano ({perfurante}).
        Aplicação de Estado:
        Se o alvo não tiver Afinidade: Terra, Água ou Fogo:
        → O alvo fica "Queimando".`;
  },

  hookScope: {
    onAfterDmgDealing: "source",
  },

  onAfterDmgDealing({ source, target, owner, damage, skill, context }) {
    console.log("[KAI] Hook onAfterDmgDealing disparado");
    console.log("[KAI] Owner:", owner?.name);
    console.log("[KAI] Skill usada:", skill?.key);
    console.log("[KAI] Dano causado:", damage);
    console.log("[KAI] Target:", target?.name);

    if (!skill) {
      console.log("[KAI] Abortado: skill inexistente");
      return;
    }

    if (owner.runtime?.fireStance !== "brasa_viva") {
      if (skill.key !== "ataque_basico") {
        console.log("[KAI] Abortado: skill não é ataque básico");
        return;
      }
    }

    if (damage <= 0) {
      console.log("[KAI] Abortado: dano <= 0");
      return;
    }

    const impactDamage =
      owner.runtime?.fireStance === "brasa_viva" ? 35 : this.flamingFistsDamage;

    console.log("[KAI] Impacto térmico ativado");
    console.log("[KAI] Dano adicional:", impactDamage);

    const result = new DamageEvent({
      mode: "hybrid",
      baseDamage: impactDamage,
      piercingPortion: impactDamage,
      attacker: source,
      defender: target,
      skill: {
        key: "flaming_fists_bonus",
        name: this.name,
      },
      context,
      allChampions: context?.allChampions,
    }).execute();

    console.log("[KAI] Resultado do impacto térmico:", result);

    if (result?.totalDamage > 0) {
      console.log("[KAI] Impacto causou dano, verificando afinidade elemental");

      const affinities = target.elementalAffinities ?? [];

      console.log("[KAI] Afinidade do alvo:", affinities);

      if (
        owner.runtime?.fireStance !== "brasa_viva" &&
        !affinities.some((a) => ["earth", "water", "fire"].includes(a))
      ) {
        console.log("[KAI] Alvo elegível para QUEIMANDO");

        const burnDuration =
          owner.runtime?.fireStance === "brasa_viva" ? 2 : this.burnDuration;

        target.applyStatusEffect("queimando", burnDuration, context, {
          source: owner.name,
        });

        console.log("[KAI] StatusEffect 'queimando' aplicada por", owner.name);
      } else {
        console.log(
          "[KAI] Alvo possui afinidade elemental resistente → queimadura NÃO aplicada",
        );
      }
    } else {
      console.log(
        "[KAI] Impacto térmico não causou dano → queimadura não verificada",
      );
    }

    console.log("[KAI] Hook finalizado");

    return {
      log: `${formatChampionName(source)} aplica ${impactDamage} de dano térmico a ${formatChampionName(target)} com ${owner.name}.`,
    };
  },
};
