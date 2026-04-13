import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "intimidacao_colossal",
  name: "Intimidação Colossal",
  hookScope: {
    onValidateAction: "target",
  },
  threshold: 0.4, // 40% do Ataque de Sengoku
  description() {
    return `Personagens inimigos com menos de ${this.threshold * 100}% do Ataque de Sengoku não conseguem mirá-lo como alvo: a ação falha.`;
  },
  /**
   * Bloqueia ações de inimigos com menos de 40% do Ataque de Sengoku Primordial.
   * @param {object} params - Parâmetros do hook
   * @param {object} params.action - Objeto da ação
   * @param {object} params.actionSource - Campeão que está tentando agir
   * @param {object} params.target - Alvo da ação (sempre o Sengoku aqui)
   * @param {object} params.context - Contexto do combate
   * @param {object} params.owner - O próprio Sengoku
   */
  onValidateAction({ action, actionSource, target, context, owner }) {
    // Não bloqueia auto-target (ele mesmo)
    if (!actionSource || actionSource.id === owner.id) return;

    // Se o atacante tem menos de 40% do ataque do Sengoku, bloqueia
    const threshold = owner.Attack * this.threshold;
    if (
      typeof actionSource.Attack !== "number" ||
      actionSource.Attack >= threshold
    )
      return;

    // Mensagem de bloqueio
    const message = `${formatChampionName(actionSource)} sente uma pressão colossal e falha ao tentar agir contra ${formatChampionName(owner)}!`;
    if (context?.registerDialog) {
      context.registerDialog({
        message,
        sourceId: actionSource.id,
        targetId: owner.id,
      });
    }
    return {
      deny: true,
      message,
    };
  },
};
