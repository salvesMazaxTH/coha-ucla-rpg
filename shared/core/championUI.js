import { StatusIndicator } from "../ui/statusIndicator.js";
import { StatusEffectsRegistry } from "../data/statusEffects/effectsRegistry.js";

/**
 * Create the champion DOM element
 * @param {object} champion - The champion instance
 * @param {object} handlers - Event handlers
 * @returns {HTMLElement} Champion element
 */
function createChampionElement(champion, handlers = {}) {
  const div = document.createElement("div");
  div.classList.add("champion");
  div.dataset.championId = champion.id;
  div.dataset.team = champion.team;
  div.dataset.entityType = champion.entityType ?? "champion";

  div.innerHTML = buildChampionHTML(champion, { editMode: handlers.editMode });

  return div;
}

/**
 * Build champion HTML
 * @param {object} champion - The champion instance
 * @param {object} config - Configuration
 * @returns {string} HTML string
 */
function buildChampionHTML(champion, { editMode } = {}) {
  const isEditModeEnabled = editMode?.enabled === true;

  return `
  <div class="portrait-wrapper">
    <div class="portrait" data-id="${champion.id}">
      <img 
        data-id="${champion.id}"
        src="${champion.portrait}"
      >
    </div>
    
  </div> 

    <p>HP: <span class="hp">${champion.HP}/${champion.maxHP}</span></p>

    <div class="hp-bar">
      <div class="hp-fill"></div>
      <div class="hp-segments"></div>
    </div>

      <div class="ult-bar">
        <div class="ult-fill"></div>
        <div class="ult-segments"></div>
    </div>

    ${
      isEditModeEnabled
        ? `
      <div class="delete">
        <button class="delete-btn" data-id="${champion.id}">
          <i class='bx bx-trash'></i>
        </button>
      </div>
    `
        : ""
    }
  `;
}

/**
 * Bind event handlers to champion element
 * @param {object} champion - The champion instance
 * @param {HTMLElement} div - Champion DOM element
 * @param {object} handlers - Event handlers
 */
function bindChampionHandlers(champion, div, handlers = {}) {
  const { onDelete } = handlers;

  // botão de deletar
  div.querySelector(".delete-btn")?.addEventListener("click", () => {
    onDelete?.(champion.id);
  });
  // abrir o overlay do card do campeão
  div.querySelector(".portrait")?.addEventListener("click", (e) => {
    handlers.onPortraitClick?.(champion);
  });

  // 🔥 bloquear menu padrão da imagem
  const img = div.querySelector(".portrait img");
  if (img) {
    img.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

/**
 * Render champion to DOM
 * @param {object} champion - The champion instance
 * @param {HTMLElement} container - Container to append to
 * @param {object} handlers - Event handlers
 */
export function renderChampion(champion, container, handlers = {}) {
  const div = createChampionElement(champion, handlers);
  bindChampionHandlers(champion, div, handlers);

  champion.el = div;
  container.appendChild(div);

  updateChampionUI(champion, {
    freeCostSkills: handlers.editMode?.freeCostSkills === true,
  });
}

/**
 * Update champion UI
 * @param {object} champion - The champion instance
 * @param {object} context - Update context
 */
export function updateChampionUI(champion, context) {
  if (!champion.el) return;

  // =========================
  // PORTRAIT
  // ============ =============
  const portrait = champion.el.querySelector(".portrait img");
  if (portrait) {
    portrait.src = champion.portrait;
  }

  // =========================
  // HP
  // =========================

  const HpDiv = champion.el.querySelector(".hp");
  const fill = champion.el.querySelector(".hp-fill");

  // Remove escudos vazios PRIMEIRO
  if (Array.isArray(champion.runtime?.shields)) {
    champion.runtime.shields = champion.runtime.shields.filter(
      (s) => s.amount > 0,
    );
  }

  const hasShield =
    Array.isArray(champion.runtime?.shields) &&
    champion.runtime.shields.length > 0;

  // Texto base
  let hpText = `${champion.HP}/${champion.maxHP}`;

  // Se tiver escudo, soma total e adiciona ao texto
  if (hasShield) {
    const totalShield = champion.runtime.shields.reduce(
      (sum, s) => sum + s.amount,
      0,
    );
    hpText += ` 🛡️ (${totalShield})`;
    champion.el.classList.add("has-shield");
  } else {
    champion.el.classList.remove("has-shield");
  }

  HpDiv.textContent = hpText;

  // Barra de HP
  const percent = (champion.HP / champion.maxHP) * 100;
  fill.style.width = `${percent}%`;

  if (percent <= 19) {
    fill.style.background = "#ff2a2a";
  } else if (percent <= 49) {
    fill.style.background = "#ffcc00";
  } else {
    fill.style.background = "#00ff66";
  }
  // =========================
  // ULTÔMETRO
  // =========================

  const ultValueEl = champion.el.querySelector(".ult");
  const ultFillEl = champion.el.querySelector(".ult-fill");
  const ultSegments = champion.el.querySelector(".ult-segments");

  const currentUnits = champion.ultMeter || 0;
  const totalUnits = 24;
  const unitsPerSegment = 4;
  const segmentCount = totalUnits / unitsPerSegment;

  if (ultValueEl) {
    ultValueEl.textContent = `${currentUnits}/${totalUnits}`;
  }

  if (ultFillEl) {
    const percent = (currentUnits / totalUnits) * 100;
    ultFillEl.style.width = `${percent}%`;
  }

  if (ultSegments) {
    const currentCount = Number(ultSegments.dataset.segmentCount) || 0;

    if (currentCount !== segmentCount) {
      ultSegments.innerHTML = "";
      for (let i = 0; i < segmentCount; i++) {
        ultSegments.appendChild(document.createElement("div"));
      }
      ultSegments.dataset.segmentCount = segmentCount;
    }
  }

  // =========================
  // SEGMENTOS (HP)
  // =========================

  const hpSegments = champion.el.querySelector(".hp-segments");
  if (hpSegments) {
    const hpPerSegment = 50;
    const hpSegmentCount = Math.floor(champion.maxHP / hpPerSegment);
    const currentHpCount = Number(hpSegments.dataset.segmentCount) || 0;

    if (hpSegmentCount !== currentHpCount) {
      hpSegments.innerHTML = "";
      for (let i = 0; i < hpSegmentCount; i++) {
        hpSegments.appendChild(document.createElement("div"));
      }
      hpSegments.dataset.segmentCount = String(hpSegmentCount);
    }
  }

  // =========================
  // Status indicators
  // =========================

  StatusIndicator.updateChampionIndicators(champion);
  // =========================
  // Botões das skills (bloqueio por ação já tomada)
  // =========================

  syncChampionActionStateUI(champion);
}

/**
 * Sync action state UI
 * @param {object} champion - The champion instance
 */
export function syncChampionActionStateUI(_champion) {
  // skill buttons have been removed from champion cards; action is handled via the action bar
}

/**
 * Destroy champion DOM
 * @param {object} champion - The champion instance
 */
export function destroyChampion(champion) {
  /* console.log(
    `[Server Champion.destroy() called for ${champion.name} (ID: ${champion.id})`,
  );
  */
  // console.log(`[Client] this.el value:`, champion.el);
  // console.log(`[Client] typeof this.el:`, typeof champion.el);
  // Remove do DOM
  if (champion.el) {
    champion.el.remove();
    champion.el = null;
    /* console.log(
      `[Client] Removed DOM element for ${champion.name} (ID: ${champion.id}).`,
    );
    */
  } else {
    /* console.log(
      `[Client] No DOM element (this.el) found for ${champion.name} (ID: ${champion.id}) to remove.`,
    );
    */
  }
}
