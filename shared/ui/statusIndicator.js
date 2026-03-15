import {
  createVFXCanvas,
  playVFX,
} from "../../public/js/animation/vfx/vfxManager.js";

/**
 * Sistema de indicadores visuais para status de campeões
 * Gerencia exibição de ícones e efeitos visuais baseados em statusEffects
 */
export const StatusIndicator = {
  // Mapeamento de statusEffects -> ícones e cores
  statusEffectIcons: {
    paralisado: {
      type: "image",
      value: "/assets/paralisado_indicator.png",
      background: "rgba(226, 109, 31, 0.8)",
    },
    atordoado: {
      type: "emoji",
      value: "💫",
      background: "rgba(241, 241, 241, 0.8)",
    },
    gelado: {
      type: "emoji",
      value: "❄️",
      background: "rgba(173, 216, 230, 0.8)",
    },
    congelado: {
      type: "canvas",
      value: null,
      background: null,
    },
    inerte: {
      type: "emoji",
      value: "🔒",
      background: "rgba(128, 128, 128, 0.8)",
    },
    condutor: {
      type: "emoji",
      value: "⚡",
      background: "rgba(255, 255, 0, 0.8)",
    },
    "imunidade absoluta": {
      type: "image",
      value: "/assets/imunidade_absoluta_indicator.png",
      background: "rgba(0, 255, 255, 0.8)",
    },
    tributo: {
      type: "text",
      value: "TRIB.",
      color: "#ff2a2a",
    },
    queimando: {
      type: "emoji",
      value: "🔥",
      background: "rgba(255, 69, 0, 0.8)",
    },
    enraizado: {
      type: "emoji",
      value: "🌱",
      background: "rgba(34, 139, 34, 0.8)",
    },
  },

  // Duração mínima visual para indicadores (em ms)
  VISUAL_DELAY: 1500, // 1.5 segundos para garantir que o jogador veja a animação

  // Controle de rotação por champion
  //_rotationTimers: new Map(),
  ROTATION_INTERVAL: 1750,
  _rotationTimer: null,
  _rotationIndex: 0,

  /**
   * Atualiza os indicadores visuais de um campeão com base em seus statusEffects
   * @param {Champion} champion - Instância do campeão
   */
  updateChampionIndicators(champion) {
    if (!champion.el) return;

    const portrait = champion.el.querySelector(".portrait");
    if (!portrait) return;

    // Remove antigos
    portrait
      .querySelectorAll(".status-indicator:not(.visual-delay)")
      .forEach((el) => el.remove());

    for (const [statusEffectName] of champion.statusEffects.entries()) {
      const icon = this.statusEffectIcons[statusEffectName.toLowerCase()];
      if (!icon) continue;

      const indicator = document.createElement("span");
      indicator.className = "status-indicator";
      indicator.dataset.statusEffect = statusEffectName;
      indicator.title = statusEffectName;

      // Safe class
      const safe = statusEffectName
        .toLowerCase()
        .replace(/\s+/g, "_")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      indicator.classList.add(`status-${safe}`);

      // Conteúdo visual
      if (icon.type === "emoji") {
        indicator.textContent = icon.value;
        indicator.style.fontSize = "1.75em";
      } else if (icon.type === "text") {
        indicator.textContent = icon.value;
        indicator.style.color = icon.color || "#ffffff";
        indicator.style.left = "45%";
        indicator.style.top = "12%";
        indicator.style.fontSize = "1.55em";
        indicator.style.fontWeight = "bold";
      } else if (icon.type === "canvas") {
        const canvas = createVFXCanvas("congelado", champion);
        playVFX("congelado", canvas);
      } else {
        const img = document.createElement("img");
        img.src = icon.value;
        img.alt = statusEffectName;
        img.className = "indicator-image";
        indicator.appendChild(img);
      }
      indicator.style.backgroundColor = icon.background || "rgba(0, 0, 0, 0.6)";

      portrait.appendChild(indicator);
    }
  },

  startRotationLoop(champions) {
    if (this._rotationTimer) return; // evita duplicação

    this._rotationTimer = setInterval(() => {
      this._rotationIndex++;

      champions.forEach((champion) => {
        const portrait = champion.el?.querySelector(".portrait");
        if (!portrait) return;

        const indicators = portrait.querySelectorAll(".status-indicator");
        if (indicators.length <= 1) return;

        indicators.forEach((el, i) => {
          el.style.opacity =
            i === this._rotationIndex % indicators.length ? "1" : "0";
        });
      });
    }, this.ROTATION_INTERVAL);
  },

  /**
   * Remove indicador específico de um campeão com visual delay
   * @param {Champion} champion - Instância do campeão
   * @param {string} statusEffectName - Nome do statusEffect
   */
  removeIndicator(champion, statusEffectName) {
    if (!champion.el) return;

    const portraitElement = champion.el.querySelector(".portrait");
    // console.log("[removeIndicator] portraitElement:", portraitElement);
    if (!portraitElement) return;

    const indicator = portraitElement.querySelector(
      `[data-statusEffect="${statusEffectName}"]`,
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

    const portraitElement = champion.el.querySelector(".portrait");
    // console.log("[clearIndicators] portraitElement:", portraitElement);

    if (!portraitElement) return;

    const indicators = portraitElement.querySelectorAll(".status-indicator");
    indicators.forEach((el) => el.remove());
  },

  /**
   * Anima a adição de um novo indicador
   * @param {Champion} champion - Instância do campeão
   * @param {string} statusEffectName - Nome do statusEffect
   */
  animateIndicatorAdd(champion, statusEffectName) {
    this.updateChampionIndicators(champion);

    const portraitElement = champion.el?.querySelector(".portrait");
    //console.log("[animateIndicatorAdd] portraitElement:", portraitElement);

    if (!portraitElement) return;

    const indicator = portraitElement.querySelector(
      `[data-statusEffect="${statusEffectName}"]`,
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
   * @param {string} statusEffectName - Nome do statusEffect
   */
  animateIndicatorRemove(champion, statusEffectName) {
    const portraitElement = champion.el?.querySelector(".portrait");
    // console.log("[animateIndicatorRemove] portraitElement:", portraitElement);

    if (!portraitElement) return;

    const indicator = portraitElement.querySelector(
      `[data-statusEffect="${statusEffectName}"]`,
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
