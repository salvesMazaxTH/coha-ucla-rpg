import { StatusIndicator } from "./statusIndicator.js";

export class Champion {
  constructor(data = {}) {
    const { identity = {}, stats = {}, combat = {}, runtime = {} } = data;

    // IDENTIDADE
    this.id = identity.id;
    this.name = identity.name;
    this.portrait = identity.portrait;
    this.team = identity.team;
    this.entityType = identity.entityType ?? "champion";

    // STATS
    // Stats atuais
    this.HP = stats.HP;
    this.maxHP = stats.HP;
    this.Attack = stats.Attack;
    this.Defense = stats.Defense;
    this.Speed = stats.Speed;
    this.Evasion = stats.Evasion;
    this.Critical = stats.Critical;
    this.LifeSteal = stats.LifeSteal;
    // Base Stats (ESSENCIAL)
    this.baseHP = stats.HP;
    this.baseAttack = stats.Attack;
    this.baseDefense = stats.Defense;
    this.baseSpeed = stats.Speed;
    this.baseEvasion = stats.Evasion;
    this.baseCritical = stats.Critical;
    this.baseLifeSteal = stats.LifeSteal;

    // COMBATE
    this.skills = combat.skills;
    this.passive = combat.passive || null;
    this.damageModifiers = [];
    this.statModifiers = [];
    this.provokeEffects = [];
    this.damageReductionModifiers = [];
    this.keywords = new Map();
    this.alive = true;
    this.cooldowns = new Map();
    this.hasActedThisTurn = false;

    // RUNTIME
    this.runtime = {
      ...runtime,
      shields: Array.isArray(runtime?.shields) ? runtime.shields : [],
    };

    // 🔥 ULTIMATE LOCK (cooldown inicial)
    this.initUltimateLock();
  }

  // Método para inicializar o bloqueio da ultimate no início do combate
  initUltimateLock() {
    if (!this.skills || this.skills.length === 0) return;

    // Convenção: última skill = ultimate
    const ultimate = this.skills[this.skills.length - 1];

    if (!ultimate.cooldown || ultimate.cooldown <= 0) return;

    const availableAt = 3; // 🔥 Regra global fixa

    this.cooldowns.set(ultimate.key, {
      availableAt,
      duration: 2, // apenas informativo/debug
      isUltimateLock: true, // só pra debug
    });

    console.log(
      `[ULT LOCK] ${this.name} → ${ultimate.name} bloqueada até o turno ${availableAt}`,
    );
  }

  static fromBaseData(baseData, id, team) {
    return new Champion({
      identity: {
        id,
        name: baseData.name,
        portrait: baseData.portrait,
        team,
        entityType: baseData.entityType,
      },

      stats: {
        HP: baseData.HP,
        Attack: baseData.Attack,
        Defense: baseData.Defense,
        Speed: baseData.Speed,
        Evasion: baseData.Evasion,
        Critical: baseData.Critical,
        LifeSteal: baseData.LifeSteal,
      },

      combat: {
        skills: baseData.skills.map((s) => ({ ...s })),
        passive: baseData.passive,
      },
    });
  }

  // Método para serializar o estado do campeão
  serialize() {
    return {
      id: this.id,
      championKey:
        typeof this.id === "string" && this.id.includes("-")
          ? this.id.split("-")[0]
          : this.name,

      team: this.team,

      name: this.name,
      portrait: this.portrait,

      HP: this.HP,
      maxHP: this.maxHP,
      Attack: this.Attack,
      Defense: this.Defense,
      Speed: this.Speed,
      Evasion: this.Evasion,
      Critical: this.Critical,
      LifeSteal: this.LifeSteal,

      runtime: {
        ...this.runtime,
        shields: Array.isArray(this.runtime?.shields)
          ? this.runtime.shields
          : [],
      },

      keywords: Array.from(this.keywords.entries()),
      skills: this.skills.map((s) => ({
        key: s.key,
        name: s.name,
        description: s.description,
        priority: s.priority || 0,
      })),

      cooldowns: Array.from(this.cooldowns.entries()),
    };
  }

  // ======== Keyword System ========
  normalizeKeywordName(keywordName) {
    if (typeof keywordName !== "string") return "";
    return keywordName.trim().toLowerCase();
  }
  /**
   * Apply a keyword effect to this champion
   * @param {string} keywordName - Name of the keyword (e.g., 'inerte', 'imunidade absoluta')
   * @param {number} duration - Number of turns the keyword lasts
   * @param {object} context - Context with currentTurn
   * @param {object} metadata - Additional data to store with the keyword
   */
  applyKeyword(keywordName, duration, context, metadata = {}) {
    const normalizedName = this.normalizeKeywordName(keywordName);
    const { currentTurn } = context || {};

    if (
      this.hasKeyword("imunidade absoluta") &&
      normalizedName !== "imunidade absoluta"
    ) {
      console.log(
        `[Champion] ${this.name} possui "Imunidade Absoluta" e não pode receber a keyword "${keywordName}".`,
      );
      return;
    }

    duration = Number.isFinite(duration) ? duration : 1; // Duração padrão de 1 turno

    const persistent = metadata?.persistent || false;
    persistent ? (duration = Infinity) : null; // Se for persistente, ignora a duração

    this.keywords.set(normalizedName, {
      expiresAtTurn: Number.isFinite(currentTurn)
        ? currentTurn + Number(duration || 0)
        : NaN,
      duration,
      appliedAtTurn: currentTurn,
      ...metadata,
    });
    console.log(
      `[Champion] ${this.name} aplicou keyword "${normalizedName}" até o turno ${currentTurn + duration}.`,
    );

    // 🎨 Atualiza os indicadores visuais
    StatusIndicator.animateIndicatorAdd(this, normalizedName);
  }

  /**
   * Check if champion has an active keyword
   * @param {string} keywordName - Name of the keyword
   * @returns {boolean}
   */
  hasKeyword(keywordName) {
    return this.keywords.has(this.normalizeKeywordName(keywordName));
  }

  /**
   * Get keyword data
   * @param {string} keywordName - Name of the keyword
   * @returns {object|null}
   */
  getKeyword(keywordName) {
    return this.keywords.get(this.normalizeKeywordName(keywordName)) || null;
  }

  /**
   * Remove a keyword immediately
   * @param {string} keywordName - Name of the keyword to remove
   */
  removeKeyword(keywordName) {
    const normalizedName = this.normalizeKeywordName(keywordName);
    if (this.keywords.has(normalizedName)) {
      this.keywords.delete(normalizedName);
      console.log(
        `[Champion] Keyword "${normalizedName}" removido de ${this.name}.`,
      );

      // 🎨 Anima a remoção do indicador
      StatusIndicator.animateIndicatorRemove(this, normalizedName);
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
    duration = 1,
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
      Critical: { min: 0, max: 95 },
      Evasion: { min: 0, max: 95 },
      default: { min: 10, max: 999 },
    };

    const { min, max } = limits[statName] || limits.default;

    const previous = this[statName];
    const clamped = Math.max(min, Math.min(previous + amount, max));
    const appliedAmount = clamped - previous;

    this[statName] = clamped;

    const isCappedMax = amount > 0 && appliedAmount === 0;
    const capLog = isCappedMax ? `O stat ${statName} já está no máximo.` : null;

    if (appliedAmount !== 0) {
      this.statModifiers.push({
        statName: statName,
        amount: appliedAmount,
        expiresAtTurn: context.currentTurn + duration,
        isPermanent: isPermanent, // Identifica se a mudança é permanente
      });
    }

    console.log(
      `[Champion] ${this.name} teve ${statName} alterado em ${appliedAmount}. ` +
        (isPermanent
          ? "A alteração é permanente e não será revertida."
          : `A alteração será revertida no turno ${context.currentTurn + duration}.`),
    );

    return {
      appliedAmount,
      isCappedMax,
      log: capLog,
    };
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

  addShield(amount, decayPerTurn = 0, context) {
    /*     console.log("SERVER ADD SHIELD:", this.name, amount); */

    this.runtime.shields.push({
      amount,
      decayPerTurn,
    });

    console.log(
      `[Champion] ${this.name} ganhou um escudo de ${amount} HP com decaimento de ${decayPerTurn} por turno.`,
    );
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

  applyDamageReduction({amount, duration, context}) {
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
    const buildChampionHTML = ({ editMode = true } = {}) => {
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
                data-default-label="${label}"
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
        <div class="portrait" data-id="${this.id}">
          <img 
            data-id="${this.id}"
            src="${this.portrait}"
          >
        </div>

        <h3 class="champion-name">${this.name}</h3>

        <p>HP: <span class="hp">${this.HP}/${this.maxHP}</span></p>

        <div class="hp-bar">
          <div class="hp-fill"></div>
        </div>

        ${statRow("Ataque", "Attack", this.Attack)}
        ${statRow("Defesa", "Defense", this.Defense)}
        ${statRow("Velocidade", "Speed", this.Speed)}
        ${this.Evasion > 0 ? statRow("Evasão", "Evasion", this.Evasion + "%") : ""}
        ${this.Critical > 0 ? statRow("Crítico", "Critical", this.Critical + "%") : ""}
        ${statRow("Roubo&nbsp;de&nbsp;Vida", "LifeSteal", this.LifeSteal + "%")}

        <div class="skills-bar">
          ${skillsHTML}
        </div>

        ${
          editMode
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
  updateUI(currentTurn) {
    if (!this.el) {
      /*       console.error(
        `[Client] No DOM element (this.el) found for ${this.name} (ID: ${this.id}).`,
      ); */
      return;
    }
    console.log(
      `[Client] Updating HP for ${this.name}: ${this.HP}/${this.maxHP}`,
    );

    const normalizedTurn = Number.isFinite(currentTurn) ? currentTurn : null;

    // HP
    const HpDiv = this.el.querySelector(".hp");

    HpDiv.textContent = `${this.HP}/${this.maxHP}`;

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

    if (this.runtime?.shields?.length) {
      const totalShield =
        this.runtime.shields.reduce((sum, s) => sum + s.amount, 0) ?? 0;

      const extraInfo = ` 🛡️ (${totalShield})`;

      HpDiv.textContent += extraInfo;
    }

    // 🔥 Função genérica pra stats
    const updateStat = (name) => {
      const el = this.el.querySelector(`.${name}`);
      if (!el) return;

      const current = this[name];
      const base = this[`base${name}`];

      const formattedValue =
        name === "Critical" || name === "Evasion" || name === "LifeSteal"
          ? `${Number(current)}%`
          : current;

      el.textContent = formattedValue;

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
    updateStat("Evasion");
    updateStat("Critical");
    updateStat("LifeSteal");

    const cooldowns =
      this.cooldowns instanceof Map
        ? this.cooldowns
        : new Map(this.cooldowns || []);

    this.el.querySelectorAll(".skill-btn").forEach((button) => {
      const skillKey = button.dataset.skillKey;
      const entry = cooldowns.get(skillKey);
      const remaining =
        entry && normalizedTurn !== null
          ? entry.availableAt - normalizedTurn
          : null;
      const isOnCooldown = Boolean(entry && remaining > 0);

      if (isOnCooldown) {
        if (!button.disabled) {
          button.dataset.disabledByCooldown = "true";
        }
        button.disabled = true;
        button.dataset.cooldownActive = "true";
        button.classList.add("cooldown");
        button.innerHTML = `
          <i class="bx bx-hourglass"></i>
          <span class="skill-cooldown-number">${remaining}</span>
        `;
      } else {
        button.classList.remove("cooldown");
        button.dataset.cooldownActive = "false";

        if (button.dataset.disabledByCooldown === "true") {
          button.disabled = false;
          button.dataset.disabledByCooldown = "false";
        }

        const defaultLabel = button.dataset.defaultLabel || "";
        button.innerHTML = `<span class="skill-label">${defaultLabel}</span>`;
      }
    });

    const lifeStealRow = this.el.querySelector(
      `.stat-row[data-stat="LifeSteal"]`,
    );
    if (lifeStealRow) {
      lifeStealRow.style.display = this.LifeSteal > 0 ? "" : "none";
    }

    // 🎨 Atualiza os indicadores de status
    StatusIndicator.updateChampionIndicators(this);
  }

  takeDamage(amount, context) {
    if (!this.alive) return;

    for (const shield of this.runtime.shields) {
      if (amount <= 0) break;

      const absorbed = Math.min(shield.amount, amount);
      shield.amount -= absorbed;
      amount -= absorbed;
    }

    if (this.hasKeyword?.("epifania_ativa") && this.HP - amount <= 0) {
      const lockedHP = this.HP >= 50 ? 50 : this.HP;

      this.HP = lockedHP;

      this.applyKeyword("imunidade absoluta", {
        source: "epifania",
      });

      context?.extraLogs?.push(
        `${this.name} recusou a morte e tornou-se Imune!`,
      );

      return;
    }

    this.HP -= amount;
    this.HP = this.roundToFive(this.HP);

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
