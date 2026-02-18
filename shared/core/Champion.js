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

    this.initializeResources(stats);

    // COMBATE
    this.skills = combat.skills;
    this.passive = combat.passive || null;
    this.damageModifiers = [];
    this.statModifiers = [];
    this.provokeEffects = [];
    this.damageReductionModifiers = [];
    this.keywords = new Map();
    this.alive = true;
    this.hasActedThisTurn = false;

    // RUNTIME
    this.runtime = this.buildRuntime(runtime);
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
        maxMana: baseData.maxMana,
        maxEnergy: baseData.maxEnergy,
      },

      combat: {
        skills: baseData.skills.map((s) => ({ ...s })),
        passive: baseData.passive,
      },
    });
  }

  // Método para serializar o estado do campeão
  serialize() {
    const resourceState = this.getResourceState();
    const resourcePayload =
      resourceState.type === "energy"
        ? {
            energy: resourceState.current,
            maxEnergy: resourceState.max,
          }
        : {
            mana: resourceState.current,
            maxMana: resourceState.max,
          };

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

      ...resourcePayload,

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
    };
  }

  roundResource(value) {
    return Math.round(Number(value) || 0);
  }

  initializeResources(stats = {}) {
    const hasEnergy = Number.isFinite(stats.maxEnergy);
    const hasMana = Number.isFinite(stats.maxMana);

    if (hasEnergy && hasMana) {
      throw new Error(
        `[Champion] ${this.name} declarou Mana e Energia. Apenas um recurso e permitido.`,
      );
    }

    if (hasEnergy) {
      this.maxEnergy = Math.max(1, this.roundResource(stats.maxEnergy));
      this.energy = this.roundResource(this.maxEnergy * 0.35);
      this.maxMana = undefined;
      this.mana = undefined;
      return;
    }

    const maxMana = Number.isFinite(stats.maxMana) ? stats.maxMana : 100;
    this.maxMana = Math.max(1, this.roundResource(maxMana));
    this.mana = this.roundResource(this.maxMana * 0.35);
    this.maxEnergy = undefined;
    this.energy = undefined;
  }

  buildRuntime(runtime = {}) {
    return {
      ...runtime,
      shields: Array.isArray(runtime?.shields) ? runtime.shields : [],
      resourceRegenMultiplier: Number.isFinite(runtime?.resourceRegenMultiplier)
        ? runtime.resourceRegenMultiplier
        : 1,
      resourceRegenFlatBonus: Number.isFinite(runtime?.resourceRegenFlatBonus)
        ? runtime.resourceRegenFlatBonus
        : 0,
    };
  }

  getResourceState() {
    if (this.maxEnergy !== undefined) {
      return {
        type: "energy",
        currentKey: "energy",
        maxKey: "maxEnergy",
        current: this.energy,
        max: this.maxEnergy,
      };
    }

    return {
      type: "mana",
      currentKey: "mana",
      maxKey: "maxMana",
      current: this.mana,
      max: this.maxMana,
    };
  }

  getSkillCost(skill) {
    if (!skill) return 0;

    const baseCost = Number(skill.cost);
    if (Number.isFinite(baseCost)) return Math.max(0, baseCost);

    const resource = this.getResourceState().type;
    if (resource === "energy") {
      return Number.isFinite(skill.energyCost)
        ? Math.max(0, skill.energyCost)
        : 0;
    }

    return Number.isFinite(skill.manaCost) ? Math.max(0, skill.manaCost) : 0;
  }

  spendResource(cost) {
    const amount = Math.max(0, Number(cost) || 0);
    if (amount === 0) return true;

    if (this.maxEnergy !== undefined) {
      if (this.energy < amount) return false;
      this.energy = Math.max(0, this.energy - amount);
      return true;
    }

    if (this.mana < amount) return false;
    this.mana = Math.max(0, this.mana - amount);
    return true;
  }

  restoreResource(amount) {
    const value = Math.max(0, Number(amount) || 0);
    if (value === 0) return 0;

    if (this.maxEnergy !== undefined) {
      const before = this.energy;
      const next = Math.min(this.maxEnergy, before + value);
      this.energy = next;
      return Math.max(0, next - before);
    }

    const before = this.mana;
    const next = Math.min(this.maxMana, before + value);
    this.mana = next;
    return Math.max(0, next - before);
  }

  getResourceRegenAmount(baseAmount) {
    const base = Math.max(0, Number(baseAmount) || 0);
    const multiplier = Number.isFinite(this.runtime?.resourceRegenMultiplier)
      ? this.runtime.resourceRegenMultiplier
      : 1;
    const flat = Number.isFinite(this.runtime?.resourceRegenFlatBonus)
      ? this.runtime.resourceRegenFlatBonus
      : 0;
    return this.roundResource(base * multiplier + flat);
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

    if (!normalizedName) {
      return false;
    }

    if (
      this.hasKeyword("imunidade absoluta") &&
      normalizedName !== "imunidade absoluta"
    ) {
      console.log(
        `[Champion] ${this.name} possui "Imunidade Absoluta" e não pode receber a keyword "${keywordName}".`,
      );
      return false;
    }

    // 🛡️ Ação já foi bloqueada por Escudo Supremo/Feitiço nesta execução
    if (context?.shieldBlockedTargets?.has(this.id)) {
      console.log(
        `[Champion] ${this.name}: keyword "${keywordName}" bloqueada (ação já negada por escudo).`,
      );
      return false;
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

    return true;
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
    isPercent = false,
  } = {}) {
    if (amount === 0) {
      return { appliedAmount: 0, isCappedMax: false, log: null };
    }

    if (amount > 0) {
      return this.buffStat({
        statName,
        amount,
        duration,
        context,
        isPermanent,
        isPercent,
      });
    }

    return this.debuffStat({
      statName,
      amount,
      duration,
      context,
      isPermanent,
    });
  }

  applyStatModifier({
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

    const currentTurn = context?.currentTurn ?? 0;

    if (appliedAmount !== 0) {
      this.statModifiers.push({
        statName: statName,
        amount: appliedAmount,
        expiresAtTurn: currentTurn + duration,
        isPermanent: isPermanent, // Identifica se a mudança é permanente
      });
    }

    if (appliedAmount > 0 && context?.registerBuff) {
      context.registerBuff({
        target: this,
        amount: appliedAmount,
        statName,
        sourceId: context.buffSourceId,
      });
    }

    console.log(
      `[Champion] ${this.name} teve ${statName} alterado em ${appliedAmount}. ` +
        (isPermanent
          ? "A alteração é permanente e não será revertida."
          : `A alteração será revertida no turno ${currentTurn + duration}.`),
    );

    return {
      appliedAmount,
      isCappedMax,
      log: capLog,
    };
  }

  buffStat({
    statName,
    amount,
    duration = 1,
    context,
    isPermanent = false,
    isPercent = false,
  } = {}) {
    if (!(statName in this)) {
      console.warn(`Tentativa de modificar stat inexistente: ${statName}`);
      return;
    }

    const normalizedAmount = Math.abs(Number(amount) || 0);

    let effectiveAmount = normalizedAmount;

    if (isPercent) {
      const usesBase = statName !== "HP" && statName !== "maxHP";
      const baseKey = `base${statName}`;
      const baseValue = usesBase ? this[baseKey] : this[statName];
      const percentBase = Number.isFinite(baseValue)
        ? baseValue
        : Number.isFinite(this[statName])
          ? this[statName]
          : 0;

      effectiveAmount = (percentBase * normalizedAmount) / 100;
    }

    return this.applyStatModifier({
      statName,
      amount: effectiveAmount,
      duration,
      context,
      isPermanent,
    });
  }

  debuffStat({
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

    const normalizedAmount = -Math.abs(Number(amount) || 0);

    return this.applyStatModifier({
      statName,
      amount: normalizedAmount,
      duration,
      context,
      isPermanent,
    });
  }

  modifyHP(
    amount,
    {
      duration = 1,
      context,
      isPermanent = false,
      maxHPOnly = false,
      affectMax = false,
    } = {},
  ) {
    amount = this.roundToFive(amount);

    if (amount === 0) {
      return { appliedAmount: 0, isCappedMax: false, log: null };
    }

    // 🔹 Alteração estrutural proporcional (buff real de vida)
    if (affectMax) {
      const previousHP = this.HP;

      const result =
        amount > 0
          ? this.buffStat({
              statName: "maxHP",
              amount,
              duration,
              context,
              isPermanent,
            })
          : this.debuffStat({
              statName: "maxHP",
              amount,
              duration,
              context,
              isPermanent,
            });

      // Aplica o mesmo delta ao HP atual
      const nextHP = this.roundToFive(previousHP + result.appliedAmount);
      this.HP = Math.max(0, Math.min(nextHP, this.maxHP));

      return result;
    }
    // 🔹 Apenas altera o teto, sem mexer proporcionalmente
    if (maxHPOnly) {
      return amount > 0
        ? this.buffStat({
            statName: "maxHP",
            amount,
            duration,
            context,
            isPermanent,
          })
        : this.debuffStat({
            statName: "maxHP",
            amount,
            duration,
            context,
            isPermanent,
          });
    }

    // 🔹 HP atual (cura/dano)
    if (amount > 0) {
      this.heal(amount, context);
    } else {
      const previous = this.HP;
      const newHP = Math.max(0, previous + amount); // amount já é negativo
      this.HP = newHP;
    }

    return {
      appliedAmount: amount,
      isCappedMax: false,
      log: null,
    };
  }

  /**
   * Checks if this champion has a spell/supreme shield that blocks the current action.
   * If blocked, consumes the shield and returns true.
   * @param {object} context - Combat context (must have currentSkill for spell shield check)
   * @returns {boolean}
   */
  _checkAndConsumeShieldBlock(context) {
    if (!Array.isArray(this.runtime?.shields)) return false;

    // 🛡️ Escudo Supremo: bloqueia QUALQUER ação
    const supremeIdx = this.runtime.shields.findIndex(
      (s) => s.type === "supreme" && s.amount > 0,
    );
    if (supremeIdx !== -1) {
      this.runtime.shields.splice(supremeIdx, 1);
      console.log(
        `[Champion] 🛡️ ${this.name}: Escudo Supremo bloqueou a ação completamente e se dissipou!`,
      );
      return true;
    }

    // 🛡️ Escudo de Feitiço: bloqueia apenas ações sem contato
    if (context?.currentSkill?.contact === false) {
      const spellIdx = this.runtime.shields.findIndex(
        (s) => s.type === "spell" && s.amount > 0,
      );
      if (spellIdx !== -1) {
        this.runtime.shields.splice(spellIdx, 1);
        console.log(
          `[Champion] 🛡️ ${this.name}: Escudo de Feitiço bloqueou a ação sem contato e se dissipou!`,
        );
        return true;
      }
    }

    return false;
  }

  addShield(amount, decayPerTurn = 0, context, type = "regular") {
    /*     console.log("SERVER ADD SHIELD:", this.name, amount); */

    this.runtime.shields.push({
      amount,
      decayPerTurn,
      type, // "regular" | "spell" | "supreme"
    });

    // Registra evento de escudo no contexto para o combat dialog
    if (context?.registerShield) {
      context.registerShield({ target: this, amount });
    }

    console.log(
      `[Champion] ${this.name} ganhou um escudo de ${amount} HP (tipo: ${type}) com decaimento de ${decayPerTurn} por turno.`,
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

  applyDamageReduction({ amount, duration, context }) {
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
        if (modifier.statName === "maxHP") {
          // Keep current HP in sync with maxHP reverting
          const nextHP = this.roundToFive(this.HP - modifier.amount);
          this.HP = Math.max(0, Math.min(nextHP, this.maxHP));
        }
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
      const resourceState = this.getResourceState();
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
      <div class="portrait-wrapper">
        <div class="portrait" data-id="${this.id}">
          <img 
            data-id="${this.id}"
            src="${this.portrait}"
          >
        </div>
      </div> 

        <h3 class="champion-name">${this.name}</h3>

        <p>HP: <span class="hp">${this.HP}/${this.maxHP}</span></p>

        <div class="hp-bar">
          <div class="hp-fill"></div>
        </div>

        <p><span class="resource-label">${
          resourceState.type === "energy" ? "EN" : "MP"
        }</span>: <span class="mp">${resourceState.current}/${resourceState.max}</span></p>

        <div class="mp-bar">
          <div class="mp-fill"></div>
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
    if (!this.el) return;

    // =========================
    // HP
    // =========================

    const HpDiv = this.el.querySelector(".hp");
    const fill = this.el.querySelector(".hp-fill");

    // Remove escudos vazios PRIMEIRO
    if (Array.isArray(this.runtime?.shields)) {
      this.runtime.shields = this.runtime.shields.filter((s) => s.amount > 0);
    }

    const hasShield =
      Array.isArray(this.runtime?.shields) && this.runtime.shields.length > 0;

    // Texto base
    let hpText = `${this.HP}/${this.maxHP}`;

    // Se tiver escudo, soma total e adiciona ao texto
    if (hasShield) {
      const totalShield = this.runtime.shields.reduce(
        (sum, s) => sum + s.amount,
        0,
      );
      hpText += ` 🛡️ (${totalShield})`;
      this.el.classList.add("has-shield");
    } else {
      this.el.classList.remove("has-shield");
    }

    HpDiv.textContent = hpText;

    // Barra de HP
    const percent = (this.HP / this.maxHP) * 100;
    fill.style.width = `${percent}%`;

    if (percent <= 19) {
      fill.style.background = "#ff2a2a";
    } else if (percent <= 49) {
      fill.style.background = "#ffcc00";
    } else {
      fill.style.background = "#00ff66";
    }

    // =========================
    // STATS
    // =========================

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
        el.style.color = "#00ff66";
      } else if (current < base) {
        el.style.color = "#ff2a2a";
      } else {
        el.style.color = "#ffffff";
      }
    };

    updateStat("Attack");
    updateStat("Defense");
    updateStat("Speed");
    updateStat("Evasion");
    updateStat("Critical");
    updateStat("LifeSteal");

    // =========================
    // RECURSO (MP)
    // =========================

    const resourceState = this.getResourceState();
    const mpValueEl = this.el.querySelector(".mp");
    const mpFill = this.el.querySelector(".mp-fill");
    const resourceLabel = this.el.querySelector(".resource-label");

    if (mpValueEl && mpFill) {
      const mpCurrent = resourceState.current;
      const mpMax = resourceState.max || 1;
      const mpPercent = Math.max(0, Math.min(100, (mpCurrent / mpMax) * 100));

      mpValueEl.textContent = `${mpCurrent}/${mpMax}`;
      mpFill.style.width = `${mpPercent}%`;
      mpFill.style.background =
        resourceState.type === "energy" ? "#f4d03f" : "#4aa3ff";

      this.el.dataset.resourceType = resourceState.type;
    }

    if (resourceLabel) {
      resourceLabel.textContent = resourceState.type === "energy" ? "EN" : "MP";
    }

    // =========================
    // SKILLS (custo de recurso)
    // =========================

    this.el.querySelectorAll(".skill-btn").forEach((button) => {
      const skillKey = button.dataset.skillKey;
      const skill = this.skills.find((s) => s.key === skillKey);
      const cost = this.getSkillCost(skill);
      const hasResource = resourceState.current >= cost;

      if (!hasResource) {
        if (!button.disabled) {
          button.dataset.disabledByResource = "true";
        }
        button.disabled = true;
        button.classList.add("resource-locked");
      } else {
        button.classList.remove("resource-locked");
        if (button.dataset.disabledByResource === "true") {
          button.disabled = false;
          button.dataset.disabledByResource = "false";
        }
      }
    });

    // =========================
    // LifeSteal visibility
    // =========================

    const lifeStealRow = this.el.querySelector(
      `.stat-row[data-stat="LifeSteal"]`,
    );

    if (lifeStealRow) {
      lifeStealRow.style.display = this.LifeSteal > 0 ? "" : "none";
    }

    // =========================
    // Status indicators
    // =========================

    StatusIndicator.updateChampionIndicators(this);
  }

  takeDamage(amount, context) {
    if (!this.alive) return;

    for (const shield of this.runtime.shields) {
      // Escudos de Feitiço e Supremo não absorvem HP — só bloqueiam ações
      if (shield.type && shield.type !== "regular") continue;
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

  heal(amount, context) {
    if (!this.alive) return 0;

    const before = this.HP;
    this.HP = Math.min(this.HP + amount, this.maxHP);
    const healed = Math.max(0, this.HP - before);

    const ctx = context || this.runtime?.currentContext;
    if (healed > 0 && ctx?.registerHeal && !ctx?.suppressHealEvents) {
      ctx.registerHeal({ target: this, amount: healed });
    }

    return healed;
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
