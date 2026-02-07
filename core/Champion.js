import { StatusIndicator } from "./statusIndicator.js";

export class Champion {
  constructor({
    id,
    name,
    portrait,
    HP,
    Attack,
    Defense,
    Speed,
    Critical,
    LifeSteal,
    skills,
    team,
    passive,
  }) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.portrait = portrait;

    this.maxHP = HP;
    this.HP = HP;
    this.baseAttack = Attack;
    this.Attack = Attack;
    this.Defense = Defense;
    this.baseDefense = Defense;
    this.Speed = Speed;
    this.baseSpeed = Speed;
    this.Critical = Critical;
    this.baseCritical = Critical;
    this.LifeSteal = LifeSteal;
    this.baseLifeSteal = LifeSteal;

    this.skills = skills;
    this.passive = passive || null;

    console.log(`[Champion] Passive recebida:`, this.passive);
    console.log(
      `[Champion] onCriticalHit existe?`,
      typeof this.passive?.onCriticalHit,
    );

    this.damageModifiers = [];
    this.statModifiers = []; // New array to track temporary stat changes
    this.provokeEffects = []; // New array to track provoke effects applied to this champion
    this.damageReductionModifiers = []; // New array to track temporary damage reduction
    this.keywords = new Map(); // Map to track active keywords with durations and metadata

    this.alive = true;
    this.cooldowns = new Map();
    this.hasActedThisTurn = false; // New property to track if the champion has acted this turn
    // 🔥 ULTIMATE LOCK (cooldown inicial)
    this.initUltimateLock();
  }

  // Método para inicializar o bloqueio da ultimate no início do combate
  initUltimateLock() {
    if (!this.skills || this.skills.length === 0) return;

    // Convenção: última skill = ultimate
    const ultimate = this.skills[this.skills.length - 1];

    if (!ultimate.cooldown || ultimate.cooldown <= 0) return;

    const availableAt = ultimate.cooldown;

    this.cooldowns.set(ultimate.key, {
      availableAt,
      duration: ultimate.cooldown,
      isUltimateLock: true, // só pra debug
    });

    console.log(
      `[ULT LOCK] ${this.name} → ${ultimate.name} bloqueada até o turno ${availableAt}`,
    );
  }

  // ======== Keyword System ========
  /**
   * Apply a keyword effect to this champion
   * @param {string} keywordName - Name of the keyword (e.g., 'inerte', 'imunidade absoluta')
   * @param {number} duration - Number of turns the keyword lasts
   * @param {object} context - Context with currentTurn
   * @param {object} metadata - Additional data to store with the keyword
   */
  applyKeyword(keywordName, duration, context, metadata = {}) {
    const { currentTurn } = context;
    this.keywords.set(keywordName, {
      expiresAtTurn: currentTurn + duration,
      duration,
      appliedAtTurn: currentTurn,
      ...metadata,
    });
    console.log(
      `[Champion] ${this.name} aplicou keyword "${keywordName}" até o turno ${currentTurn + duration}.`,
    );

    // 🎨 Atualiza os indicadores visuais
    StatusIndicator.animateIndicatorAdd(this, keywordName);
  }

  /**
   * Check if champion has an active keyword
   * @param {string} keywordName - Name of the keyword
   * @returns {boolean}
   */
  hasKeyword(keywordName) {
    return this.keywords.has(keywordName);
  }

  /**
   * Get keyword data
   * @param {string} keywordName - Name of the keyword
   * @returns {object|null}
   */
  getKeyword(keywordName) {
    return this.keywords.get(keywordName) || null;
  }

  /**
   * Remove a keyword immediately
   * @param {string} keywordName - Name of the keyword to remove
   */
  removeKeyword(keywordName) {
    if (this.keywords.has(keywordName)) {
      this.keywords.delete(keywordName);
      console.log(
        `[Champion] Keyword "${keywordName}" removido de ${this.name}.`,
      );

      // 🎨 Anima a remoção do indicador
      StatusIndicator.animateIndicatorRemove(this, keywordName);
    }
  }

  /**
   * Purge all expired keywords at turn end
   * @param {number} currentTurn - Current turn number
   * @returns {array} List of removed keyword names
   */
  purgeExpiredKeywords(currentTurn) {
    const removedKeywords = [];
    for (const [keywordName, keywordData] of this.keywords.entries()) {
      if (keywordData.expiresAtTurn <= currentTurn) {
        this.keywords.delete(keywordName);
        removedKeywords.push(keywordName);
        console.log(
          `[Champion] Keyword "${keywordName}" expirou para ${this.name}.`,
        );

        // 🎨 Anima a remoção do indicador com delay visual
        StatusIndicator.animateIndicatorRemove(this, keywordName);
      }
    }
    return removedKeywords;
  }
  // ======== End Keyword System ========

  // Method to mark that the champion has acted
  markActionTaken() {
    this.hasActedThisTurn = true;
  }

  // Method to reset the action status for a new turn
  resetActionStatus() {
    this.hasActedThisTurn = false;
  }

  roundToFive(x) {
    return Math.round(x / 5) * 5;
  }

  modifyStat({
    statName,
    amount,
    duration,
    context,
    isPermanent = false,
  } = {}) {
    if (!(statName in this)) {
      console.warn(`Tentativa de modificar stat inexistente: ${statName}`);
      return;
    }

    amount = this.roundToFive(amount); // funciona inclusive para negativos

    
     // Limite de 10-99 para stats que não sejam HP, exceto ATQ
    
    const limits = {
  Attack: { min: 10, max: 150 },
  default: { min: 10, max: 99 },
};

const { min, max } = limits[statName] || limits.default;

this[statName] = Math.max(min, Math.min(this[statName] + amount, max));

    // Armazenar o modificador para reverter depois, se não for permanente
    this.statModifiers.push({
      statName: statName,
      amount: amount,
      expiresAtTurn: context.currentTurn + duration,
      isPermanent: isPermanent, // Identifica se a mudança é permanente
    });
    console.log(
      `[Champion] ${this.name} teve ${statName} alterado em ${amount}. ` +
        (isPermanent
          ? "A alteração é permanente e não será revertida."
          : `A alteração será revertida no turno ${context.currentTurn + duration}.`),
    );
  }

  modifyHP(amount, options = {}) {
    const { maxHPOnly = false, affectMax = false } = options;

    amount = this.roundToFive(amount);

    // Ajuste de maxHP
    if (maxHPOnly || affectMax) {
      this.maxHP += amount;
    }

    // Ajuste de HP atual
    if (!maxHPOnly) {
      if (amount > 0) {
        this.heal(amount);
      } else if (amount < 0) {
        this.takeDamage(-amount);
      }
    }

    // Clamps finais para garantir que HP não ultrapasse 999, o limite global
    this.maxHP = Math.max(5, Math.min(this.maxHP, 999));
    this.HP = Math.max(0, Math.min(this.HP, this.maxHP));
  }

  applyProvoke(provokerId, duration, context) {
    this.provokeEffects.push({
      provokerId: provokerId,
      expiresAtTurn: context.currentTurn + duration,
    });
    console.log(
      `[Champion] ${this.name} provoked by ${provokerId}. Will expire at turn ${context.currentTurn + duration}.`,
    );
  }

  isProvokedBy(provokerId) {
    return this.provokeEffects.some(
      (effect) => effect.provokerId === provokerId,
    );
  }

  applyDamageReduction(amount, duration, context) {
    this.damageReductionModifiers.push({
      amount: amount,
      expiresAtTurn: context.currentTurn + duration,
    });
    console.log(
      `[Champion] ${this.name} gained ${amount} damage reduction. Will expire at turn ${context.currentTurn + duration}.`,
    );
  }

  getTotalDamageReduction() {
    return this.damageReductionModifiers.reduce(
      (total, mod) => total + mod.amount,
      0,
    );
  }

  purgeExpiredStatModifiers(currentTurn) {
    const revertedStats = [];
    this.statModifiers = this.statModifiers.filter((modifier) => {
      if (modifier.expiresAtTurn <= currentTurn && !modifier.isPermanent) {
        // Revert the stat change only if not permanent
        this[modifier.statName] -= modifier.amount;
        revertedStats.push({
          championId: this.id,
          statName: modifier.statName,
          revertedAmount: -modifier.amount,
          newValue: this[modifier.statName],
        });
        console.log(
          `[Champion] ${this.name} ${modifier.statName} reverted by ${-modifier.amount}. New value: ${this[modifier.statName]}.`,
        );
        return false; // Remove expired modifier
      }
      // Keep active or permanent modifiers
      return modifier.isPermanent || modifier.expiresAtTurn > currentTurn;
    });

    this.provokeEffects = this.provokeEffects.filter((effect) => {
      if (effect.expiresAtTurn <= currentTurn) {
        console.log(
          `[Champion] Provoke effect from ${effect.provokerId} on ${this.name} expired.`,
        );
        return false;
      }
      return true;
    });

    this.damageReductionModifiers = this.damageReductionModifiers.filter(
      (modifier) => {
        if (modifier.expiresAtTurn <= currentTurn) {
          console.log(
            `[Champion] Damage reduction of ${modifier.amount} on ${this.name} expired.`,
          );
          return false;
        }
        return true;
      },
    );

    return revertedStats;
  }

  // 🖥️ Cria o HTML e se “materializa” no mundo
  render(container, handlers = {}) {
    // Função auxiliar: criar elemento do campeão
    const createChampionElement = (handlers = {}) => {
      const div = document.createElement("div");
      div.classList.add("champion");
      div.dataset.championId = this.id;
      div.dataset.team = this.team;

      div.innerHTML = buildChampionHTML({ editMode: handlers.editMode });

      return div;
    };

    // Função auxiliar: construir HTML do campeão
    const buildChampionHTML = ({ editMode = false } = {}) => {
      const statRow = (label, className, value) => `
        <div class="stat-row" data-stat="${className}" data-id="${this.id}">
          <span class="stat-label">${label}:</span>
          <span class="${className}">${value}</span>
        </div>
      `;

      const buildSkillsHTML = () => {
        return this.skills
          .map((skill, index) => {
            const isUlt = index === this.skills.length - 1;
            const isBasicAttack = index === 0;
            const label = isUlt ? "ULT" : isBasicAttack ? "AB" : `Hab.${index}`;

            return `
              <button 
                class="skill-btn ${isUlt ? "ultimate" : ""}"
                data-champion-id="${this.id}"
                data-skill-key="${skill.key}"
                data-skill-index="${index}"
                title="${skill.name}\n${skill.description || ""}"
              >
                <span class="skill-label">${label}</span>
              </button>
            `;
          })
          .join("");
      };

      const skillsHTML = buildSkillsHTML();

      return `
        <img 
          class="portrait"
          data-id="${this.id}"
          src="${this.portrait}"
        >
        <h3 class="champion-name">${this.name}</h3>

        <p>HP: <span class="hp">${this.HP}/${this.maxHP}</span></p>

        <div class="hp-bar">
          <div class="hp-fill"></div>
        </div>


        ${statRow("Ataque", "Attack", this.Attack)}
        ${statRow("Defesa", "Defense", this.Defense)}
        ${statRow("Velocidade", "Speed", this.Speed)}
        ${this.Critical > 0 ? statRow("Crítico", "Critical", this.Critical) : ""}
        ${this.LifeSteal > 0 ? statRow("Roubo de Vida", "LifeSteal", this.LifeSteal) : ""}

        <div class="skills-bar">
          ${skillsHTML}
        </div>
        ${
          editMode // no modo de edição, mostra o botão de deletar
            ? `
          <div class="delete">
            <button class="delete-btn" data-id="${this.id}">
              <i class='bx bx-trash'></i>
            </button>
          </div>
        `
            : ""
        }

      `;
    };

    // Função auxiliar: vincular handlers aos elementos
    const bindChampionHandlers = (div, handlers = {}) => {
      const { onSkillClick, onDelete } = handlers;

      // botões das skills
      div.querySelectorAll(".skill-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          onSkillClick?.(btn);
        });
      });
      // botão de deletar
      div.querySelector(".delete-btn")?.addEventListener("click", () => {
        onDelete?.(this.id);
      });
      // abrir o overlay do card do campeão
      div.querySelector(".portrait")?.addEventListener("click", (e) => {
        handlers.onPortraitClick?.(this);
      });
    };

    // Executar o fluxo
    const div = createChampionElement(handlers);
    bindChampionHandlers(div, handlers);

    this.el = div;
    container.appendChild(div);
  }

  // 🔄 Atualiza UI sem buscar no DOM toda vez
  updateUI() {
    /*  console.log(`[Client] updateUI called for ${this.name} (ID: ${this.id})`); */
    if (!this.el) {
      /*       console.error(
        `[Client] No DOM element (this.el) found for ${this.name} (ID: ${this.id}).`,
      ); */
      return;
    }
    console.log(
      `[Client] Updating HP for ${this.name}: ${this.HP}/${this.maxHP}`,
    );
    // HP
    this.el.querySelector(".hp").textContent = `${this.HP}/${this.maxHP}`;

    const fill = this.el.querySelector(".hp-fill");

    const percent = (this.HP / this.maxHP) * 100;
    fill.style.width = `${percent}%`;

    // cores dinâmicas
    if (percent <= 19) {
      fill.style.background = "#ff2a2a"; // vermelho
    } else if (percent <= 49) {
      fill.style.background = "#ffcc00"; // amarelo
    } else {
      fill.style.background = "#00ff66"; // verde
    }
    // 🔥 Função genérica pra stats
    const updateStat = (name) => {
      const el = this.el.querySelector(`.${name}`);
      if (!el) return;

      const current = this[name];
      const base = this[`base${name}`];

      el.textContent = current;

      if (current > base) {
        el.style.color = "#00ff66"; // verde
      } else if (current < base) {
        el.style.color = "#ff2a2a"; // vermelho
      } else {
        el.style.color = "#ffffff"; // neutro
      }
    };

    updateStat("Attack");
    updateStat("Defense");
    updateStat("Speed");
    updateStat("Critical");
    updateStat("LifeSteal");

    // 🎨 Atualiza os indicadores de status
    StatusIndicator.updateChampionIndicators(this);

    this.el.classList.toggle("dead", !this.alive);
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.HP -= amount;

    if (this.HP <= 0) {
      this.HP = 0;
      this.alive = false;
    }
  }

  heal(amount) {
    if (!this.alive) return;

    this.HP = Math.min(this.HP + amount, this.maxHP);
  }

  // inútil, pois remove do DOM é feito diretamente pelo Client ao receber o evento do Server
  /* die() { 
    this.alive = false;
    this.HP = 0;
    console.log(
      `[Server Champion.die() called for ${this.name} (ID: ${this.id})`,
    );
    // Fallback for client-side testing or if io is not available
    this.destroy();
  } */

  destroy() {
    console.log(
      `[Server Champion.destroy() called for ${this.name} (ID: ${this.id})`,
    );
    console.log(`[Client] this.el value:`, this.el);
    console.log(`[Client] typeof this.el:`, typeof this.el);
    // Remove do DOM
    if (this.el) {
      this.el.remove();
      this.el = null;
      console.log(
        `[Client] Removed DOM element for ${this.name} (ID: ${this.id}).`,
      );
    } else {
      console.log(
        `[Client] No DOM element (this.el) found for ${this.name} (ID: ${this.id}) to remove.`,
      );
    }
    // No longer directly removing from activeChampions here, as server will handle it
    // and send a championRemoved event.
  }

  addDamageModifier(mod) {
    this.damageModifiers.push(mod);
  }

  purgeExpiredModifiers(currentTurn) {
    this.damageModifiers = this.damageModifiers.filter((m) => {
      if (m.permanent) return true; // permanente

      return m.expiresAtTurn > currentTurn; // temporário
    });
  }

  getDamageModifiers() {
    return this.damageModifiers || [];
  }
}
