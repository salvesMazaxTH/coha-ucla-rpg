/**
 * Sistema de indicadores visuais para status de campeões
 * Gerencia exibição de ícones e efeitos visuais baseados em keywords
 */
export const StatusIndicator = {
  // Mapeamento de keywords -> ícones e cores
  keywordIcons: {
    paralisado: "⚡ 🚷 ⚡",
    atordoado: "💫",
    inerte: "🔒",
    energizado: "⚡",
    "imunidade absoluta": "🛡️",
  },

  // Duração mínima visual para indicadores (em ms)
  VISUAL_DELAY: 1500, // 1.5 segundos para garantir que o jogador veja a animação

  /**
   * Atualiza os indicadores visuais de um campeão com base em seus keywords
   * @param {Champion} champion - Instância do campeão
   */
  updateChampionIndicators(champion) {
    console.log("Updating indicators for:", champion.name);
    if (!champion.el) return;

    console.log("EL:", champion.el);
    console.log("HTML:", champion.el?.innerHTML);

    const nameElement = champion.el.querySelector(".champion-name");
    console.log("[updateChampionIndicators]nameElement:", nameElement);

    if (!nameElement) return;

    // Remove indicadores anteriores que não estão em visual delay
    const existingIndicators = nameElement.querySelectorAll(
      ".status-indicator:not(.visual-delay)",
    );
    existingIndicators.forEach((el) => el.remove());

    console.log("Keywords:", champion.keywords);

    // Adiciona novos indicadores baseado em keywords ativos
    for (const [keywordName, keywordData] of champion.keywords.entries()) {
      const icon = this.keywordIcons[keywordName.toLowerCase()];
      console.log("Keyword:", keywordName);
      console.log("Icon found:", icon);

      if (icon) {
        // Verifica se o indicador já existe para evitar duplicatas
        const existingIndicator = nameElement.querySelector(
          `[data-keyword="${keywordName}"]`,
        );
        if (existingIndicator) continue; // Pula se já existe

        const indicator = document.createElement("span");
        indicator.classList.add("status-indicator");
        indicator.textContent = ` ${icon}`;
        indicator.title = keywordName;
        indicator.dataset.keyword = keywordName;

        // Adiciona classe específica para styling
        indicator.classList.add(`status-${keywordName.toLowerCase()}`);

        nameElement.appendChild(indicator);
      }
    }
  },

  /**
   * Remove indicador específico de um campeão com visual delay
   * @param {Champion} champion - Instância do campeão
   * @param {string} keywordName - Nome do keyword
   */
  removeIndicator(champion, keywordName) {
    if (!champion.el) return;

    const nameElement = champion.el.querySelector(".champion-name");
    console.log("[removeIndicator] nameElement:", nameElement);
    if (!nameElement) return;

    const indicator = nameElement.querySelector(
      `[data-keyword="${keywordName}"]`,
    );
    if (indicator) {
      indicator.remove();
    }
  },

  /**
   * Remove todos os indicadores de um campeão
   * @param {Champion} champion - Instância do campeão
   */
  clearIndicators(champion) {
    if (!champion.el) return;

    const nameElement = champion.el.querySelector(".champion-name");
    console.log("[clearIndicators] nameElement:", nameElement);

    if (!nameElement) return;

    const indicators = nameElement.querySelectorAll(".status-indicator");
    indicators.forEach((el) => el.remove());
  },

  /**
   * Anima a adição de um novo indicador
   * @param {Champion} champion - Instância do campeão
   * @param {string} keywordName - Nome do keyword
   */
  animateIndicatorAdd(champion, keywordName) {
    this.updateChampionIndicators(champion);

    const nameElement = champion.el?.querySelector(".champion-name");
    console.log("[animateIndicatorAdd] nameElement:", nameElement);

    if (!nameElement) return;

    const indicator = nameElement.querySelector(
      `[data-keyword="${keywordName}"]`,
    );

    if (indicator) {
      indicator.classList.add("pulse");
      setTimeout(() => {
        indicator.classList.remove("pulse");
      }, 600);
    }
  },

  /**
   * Anima a remoção de um indicador com delay visual
   * @param {Champion} champion - Instância do campeão
   * @param {string} keywordName - Nome do keyword
   */
  animateIndicatorRemove(champion, keywordName) {
    const nameElement = champion.el?.querySelector(".champion-name");
    console.log("[animateIndicatorRemove] nameElement:", nameElement);

    if (!nameElement) return;

    const indicator = nameElement.querySelector(
      `[data-keyword="${keywordName}"]`,
    );

    if (indicator) {
      // Marca o indicador com visual delay para permanecer visível
      indicator.classList.add("fade-out", "visual-delay");

      // Remove a classe de erro/efeito após o fade
      setTimeout(() => {
        indicator.classList.remove("fade-out");
      }, 300);

      // Remove completamente após o visual delay
      setTimeout(() => {
        if (indicator.parentElement) {
          indicator.remove();
        }
      }, this.VISUAL_DELAY);
    }
  },
};
