import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "punhos_em_combustao",
  name: "Punhos em Combustão",
  flamingFistsDamage: 30,
  burnDuration: 1,

  description() {
    return `Sempre que Kai causa dano com um Ataque Básico, ele aplica um impacto térmico adicional:
  - O impacto térmico causa ${this.flamingFistsDamage} de dano (perfurante).

  em 'Brasa Viva':
  - Todos os ataques causam 40 de dano adicional e aplicam queimadura independente da afinidade elemental do alvo.`;
  },

  hookScope: {
    onAfterDmgDealing: "source",
    onBeforeDmgDealing: "source",
  },

  onBeforeDmgDealing({ source, owner, skill, damage }) {
    if (source !== owner) return;

    const isBrasa = owner.runtime?.fireStance === "brasa_viva";

    if (!isBrasa && skill?.key !== "ataque_basico") return;

    const bonus = isBrasa ? 40 : this.flamingFistsDamage;

    return {
      damage: damage + bonus,
    };
  },

  onAfterDmgDealing({ source, target, owner, damage, context, skill }) {
    if (source !== owner) return;
    if (damage <= 0) return;
    if (!target) return;

    const isBrasa = owner.runtime?.fireStance === "brasa_viva";
    console.log(`[${owner.name}] isBrasa: ${isBrasa}, skill: ${skill?.key}`);

    // 🔥 GATE PRINCIPAL (o que você pediu)
    if (!isBrasa && skill?.key !== "golpe_basico") return;

    const affinities = target.elementalAffinities ?? [];

    if (
      isBrasa ||
      !affinities.some((a) => ["earth", "water", "fire"].includes(a))
    ) {
      const burnDuration = isBrasa ? 2 : this.burnDuration;

      console.log(
        `Aplicando queimadura padrão (duração: ${burnDuration}) em ${target.name} por ataque de ${skill?.key}.`,
      );

      target.applyStatusEffect("queimando", burnDuration, context, {
        source: owner.name,
      });

      return {
        log: `${formatChampionName(source)} aplicou Queimadura em ${formatChampionName(target)}.`,
      };
    } else {
      console.log(
        `Não aplicando queimadura em ${target.name} por ataque de ${skill?.key} devido à afinidade elemental. Não tinha brasa viva ativa: ${isBrasa}.`,
      );
    }
  },
};
