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
      background: "",
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
      type: "emoji",
      value: "❄️",
      background: "rgba(16, 216, 230, 0.8)",
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

    const activeStatuses = new Set(
      [...champion.statusEffects.keys()].map((s) => s.toLowerCase()),
    );

    // remove indicadores que não existem mais
    portrait.querySelectorAll(".status-indicator").forEach((el) => {
      const name = el.dataset.statusEffect?.toLowerCase();
      if (!activeStatuses.has(name) && !el.classList.contains("visual-delay")) {
        el.remove();
      }
    });

    for (const [statusEffectName] of champion.statusEffects.entries()) {
      const icon = this.statusEffectIcons[statusEffectName.toLowerCase()];
      if (!icon) continue;

      let indicator = portrait.querySelector(
        `[data-status-effect="${statusEffectName}"]`,
      );

      if (!indicator) {
        const existing = portrait.querySelectorAll(
          `[data-status-effect="${statusEffectName}"]`,
        );

        if (existing.length > 0) {
          indicator = existing[0];
        } else {
          indicator = document.createElement("div");
        }

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
        } else {
          const img = document.createElement("img");
          img.src = icon.value;
          img.alt = statusEffectName;
          img.className = "indicator-image";
          indicator.appendChild(img);
        }

        indicator.style.backgroundColor = icon.background || "rgba(0,0,0,0.6)";

        portrait.appendChild(indicator);
      }
    }
  },

  startRotationLoop() {
    if (this._rotationTimer !== null) {
      console.log("[RotationLoop] already running");
      return;
    }
    console.log("[RotationLoop] started");

    if (this._rotationTimer) return;

    this._rotationTimer = setInterval(() => {
      console.log(
        "[RotationLoop] tick antes do incremento",
        this._rotationIndex,
      );

      this._rotationIndex++;

      console.log(
        "[RotationLoop] tick depois do incremento",
        this._rotationIndex,
      );

      const champions = document.querySelectorAll(".champion");

      console.log("[RotationLoop] champions count:", champions.length);

      champions.forEach((champion) => {
        const portrait = champion
          ?.querySelector(".portrait-wrapper")
          ?.querySelector(".portrait");
        if (!portrait) return;

        const indicators = portrait.querySelectorAll(".status-indicator");

        console.log(
          "[RotationLoop]",
          champion.name,
          "indicators:",
          indicators.length,
        );

        if (indicators.length <= 1) return;

        indicators.forEach((el, i) => {
          el.style.opacity =
            i === this._rotationIndex % indicators.length ? "1" : "0";
        });
      });
    }, this.ROTATION_INTERVAL);
  },
};
