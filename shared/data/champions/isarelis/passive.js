import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "punhada_pelas_costas",
  name: "Punhada pelas Costas",

  description() {
    return `Sempre que Isarelis agir antes do alvo direto, o dano base é aumentado em 20% e 60% dele se torna Perfurante.`;
  },

  damageBonusRatio: 0.2,
  piercingRatio: 0.6,
  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({
    attacker,
    owner,
    defender,
    skill,
    context,
    damage,
    baseDamage,
  }) {
    if (attacker !== owner) return;
    // Só ativa para skills de dano da Isarelis
    if (!skill || !["eviscerar", "golpe_de_misericordia"].includes(skill.key))
      return;

    // Checagem de ordem de turno
    const execIdx = context?.executionIndex;
    const turnMap = context?.turnExecutionMap;

    let actedBeforeTarget = false;
    if (execIdx !== undefined && typeof turnMap?.get === "function") {
      const targetIdx = turnMap.get(defender?.id);
      actedBeforeTarget = targetIdx === undefined || execIdx < targetIdx;
    } else {
      // Fallback para cenários sem mapa explícito de execução.
      actedBeforeTarget =
        Number(attacker?.Speed || 0) > Number(defender?.Speed || 0);
    }

    if (!actedBeforeTarget) return;

    // Aplica bônus e perfuração
    const hookBaseDamage = Number(baseDamage ?? damage ?? 0);
    const finalBaseDamage = hookBaseDamage * (1 + this.damageBonusRatio);
    const piercingPortion = finalBaseDamage * this.piercingRatio;

    context?.registerDialog?.({
      message: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(attacker)} dilacera antes da reação! (+perfuração)`,
      sourceId: attacker.id,
      targetId: defender.id,
    });

    return {
      baseDamage: finalBaseDamage,
      preMitigationDamage: finalBaseDamage,
      mode: "hybrid",
      piercingPortion,
    };
  },
};
