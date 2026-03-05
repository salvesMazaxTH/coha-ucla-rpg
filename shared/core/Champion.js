import { StatusIndicator } from "../ui/statusIndicator.js";
/* import { CombatResolver } from "./combatResolver.js";
 */
export class Champion {
  constructor(data = {}) {
    const { identity = {}, stats = {}, combat = {}, runtime = {} } = data;

    // IDENTIDADE
    this.id = identity.id;
    this.name = identity.name;
    this.portrait = identity.portrait;
    this.team = identity.team;
    this.elementalAffinities = Array.from(identity.elementalAffinities) || [];
    this.entityType = identity.entityType ?? "champion";

    // STATS
    // Stats atuais
    this.HP = stats.HP;
    this.maxHP = stats.HP;
    this.Attack = stats.Attack;
    this.Defense = stats.Defense;
    this.Speed = stats.Speed;
    this.Evasion = stats.Evasion ?? 0;
    this.Critical = stats.Critical ?? 0;
    this.LifeSteal = stats.LifeSteal ?? 0;
    // Base Stats (ESSENCIAL)
    this.baseHP = stats.HP;
    this.baseAttack = stats.Attack;
    this.baseDefense = stats.Defense;
    this.baseSpeed = stats.Speed;
    this.baseEvasion = stats.Evasion ?? 0;
    this.baseCritical = stats.Critical ?? 0;
    this.baseLifeSteal = stats.LifeSteal ?? 0;

    this.ultCap = Number.isFinite(stats.ultCap)
      ? Math.max(1, Math.round(stats.ultCap))
      : 15;
    this.ultMeter = 0;

    this.initializeResources(stats);

    // COMBATE
    this.skills = combat.skills;
    this.passive = combat.passive || null;
    this.damageModifiers = [];
    this.statModifiers = [];
    this.tauntEffects = [];
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
        elementalAffinities: baseData.elementalAffinities || [],
      },

      stats: {
        HP: baseData.HP,
        Attack: baseData.Attack,
        Defense: baseData.Defense,
        Speed: baseData.Speed,
        Evasion: baseData.Evasion,
        Critical: baseData.Critical,
        LifeSteal: baseData.LifeSteal,
        ultMeter: baseData.ultMeter,
        ultCap: baseData.ultCap,
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
      ultMeter: this.ultMeter,
      ultCap: this.ultCap,

      runtime: (() => {
        const clone = { ...this.runtime };

        delete clone.hookEffects;
        delete clone.currentContext;

        return clone;
      })(),

      keywords: Array.from(this.keywords.entries()).map(([key, value]) => {
        const safeValue = { ...value };

        if (safeValue.source && typeof safeValue.source === "object") {
          safeValue.source = {
            id: safeValue.source.id,
            name: safeValue.source.name,
          };
        }

        return [key, safeValue];
      }),
    };
  }

  // ===============================
  // ======== ULT METER CORE =======
  // ===============================

  getResourceState() {
    return {
      type: "ult",
      currentKey: "ultMeter",
      current: this.ultMeter,
      max: this.ultCap,
    };
  }

  initializeResources(stats = {}) {
    const { ultMeter = 0, ultCap } = stats;

    if (Number.isInteger(ultCap) && ultCap > 0) {
      this.ultCap = ultCap;
    }

    this.ultMeter = 0; // sempre começa validado
  }

  // -------------------------------
  // Operações públicas
  // -------------------------------

  getSkillCost(skill) {
    if (!skill) return 0;
    if (skill.isUltimate !== true) return 0;
    if (!Number.isInteger(skill.ultCost) || skill.ultCost <= 0) return 0;
    return skill.ultCost * 3; // Converte barras para unidades internas
  }

  applyRegenFromDamage(context) {
    if (!context) return 0;

    const regenAmount = 2;
    const applied = this.addUlt({ amount: regenAmount, context });

    return applied;
  }

  addUlt(input) {
    const { amount, context } = input;

    if (!Number.isInteger(amount) || amount <= 0) return 0;

    // 🔥 Primeiro altera o estado
    const applied = this._applyUltDelta(amount);

    // 🔥 Depois registra visual
    if (applied > 0 && context?.registerUltGain) {
      context.registerUltGain({
        target: this,
        amount: applied,
        sourceId: this.id,
      });
    }

    return applied;
  }

  spendUlt(cost) {
    if (this.ultMeter < cost) return false;

    this._applyUltDelta(-cost);
    return true;
  }

  // -------------------------------
  // Núcleo interno
  // -------------------------------

  _applyUltDelta(delta) {
    console.log(
      "APPLY DELTA",
      this.name,
      "instance:",
      this.id,
      "delta:",
      delta,
      "antes:",
      this.ultMeter,
    );

    if (!Number.isInteger(delta) || delta === 0) return 0;

    const next = Math.max(0, Math.min(this.ultCap, this.ultMeter + delta));
    const applied = next - this.ultMeter;

    this.ultMeter = next;
    return applied;
  }

  // -------------------------------
  // Compatibilidade (LEGACY API)
  // -------------------------------

  addResource(input) {
    return this.addUlt(input);
  }

  spendResource(cost) {
    return this.spendUlt(cost);
  }

  applyResourceChange({ amount } = {}) {
    return this._applyUltDelta(amount);
  }

  // ===============================
  // ===============================

  // ======== Runtime ========

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

    const isStackable = normalizedName === "poison";

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

    if (this.hasKeyword(normalizedName)) {
      // sobrescrever a antiga com a nova (reseta duração e metadata)
      if (!isStackable) {
        this.keywords.delete(normalizedName);
      }
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
    if (persistent) duration = Infinity; // Se for persistente, ignora a duração

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

  getKeywordData(name) {
    const normalized = this.normalizeKeywordName(name);
    return this.keywords.get(normalized) || null;
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
    this.syncActionStateUI();
  }

  // Method to reset the action status for a new turn
  resetActionStatus() {
    this.hasActedThisTurn = false;
    this.syncActionStateUI();
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

  applyTaunt(taunterId, duration, context) {
    this.tauntEffects.push({
      taunterId: taunterId,
      expiresAtTurn: context.currentTurn + duration,
    });
    console.log(
      `[Champion] ${this.name} taunted by ${taunterId}. Will expire at turn ${context.currentTurn + duration}.`,
    );
  }

  isTauntedBy(taunterId) {
    return this.tauntEffects.some((effect) => effect.taunterId === taunterId);
  }

  applyDamageReduction({ amount, duration, source = "unknown", context }) {
    this.damageReductionModifiers.push({
      amount: amount,
      expiresAtTurn: context.currentTurn + duration,
      source: source,
    });
    console.log(
      `[Champion] ${this.name} gained ${amount} damage reduction from ${source}. Will expire at turn ${context.currentTurn + duration}.`,
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

    this.tauntEffects = this.tauntEffects.filter((effect) => {
      if (effect.expiresAtTurn <= currentTurn) {
        console.log(
          `[Champion] Taunt effect from ${effect.taunterId} on ${this.name} expired.`,
        );
        return false;
      }
      return true;
    });

    this.damageReductionModifiers = this.damageReductionModifiers.filter(
      (modifier) => {
        if (modifier.expiresAtTurn <= currentTurn) {
          console.log(
            `[Champion] Damage reduction of ${modifier.amount} from ${modifier.source} on ${this.name} expired.`,
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
    const buildChampionHTML = ({ editMode } = {}) => {
      const isEditModeEnabled = editMode?.enabled === true;

      const resourceState = this.getResourceState();

      const buildSkillsHTML = () => {
        return this.skills
          .map((skill, index) => {
            const isUlt = skill.isUltimate === true;
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
          <div class="hp-segments"></div>
        </div>

          <div class="ult-bar">
            <div class="ult-fill"></div>
            <div class="ult-segments"></div>
        </div>

        <div class="skills-bar">
          ${skillsHTML}
        </div>

        ${
          isEditModeEnabled
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

      div.querySelectorAll(".skill-btn").forEach((button) => {
        const skillKey = button.dataset.skillKey;

        const champion = this;
        if (!champion) return;

        const skill = champion.skills.find((s) => s.key === skillKey);
        if (!skill) return;

        // =========================
        // DESKTOP (hover)
        // =========================
        button.addEventListener("mouseenter", (e) => {
          e.preventDefault();
          handlers.showSkillOverlay?.(button, skill, champion);
        });

        button.addEventListener("mouseout", (e) => {
          e.preventDefault();
          handlers.removeSkillOverlay?.();
        });
      });
      // 🔥 bloquear menu padrão da imagem
      const img = div.querySelector(".portrait img");
      if (img) {
        img.addEventListener("contextmenu", (e) => e.preventDefault());
      }
    };

    // Executar o fluxo
    const div = createChampionElement(handlers);
    bindChampionHandlers(div, handlers);

    this.el = div;
    container.appendChild(div);

    this.updateUI({
      freeCostSkills: handlers.editMode?.freeCostSkills === true,
    });
  }

  // 🔄 Atualiza UI sem buscar no DOM toda vez
  updateUI(context) {
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
    // ULTÔMETRO
    // =========================

    const ultValueEl = this.el.querySelector(".ult");
    const ultFillEl = this.el.querySelector(".ult-fill");
    const ultSegments = this.el.querySelector(".ult-segments");

    const currentUnits = this.ultMeter || 0;
    const totalUnits = 15; // total
    const unitsPerSegment = 3; // 3 unidades por barra grande
    const segmentCount = totalUnits / unitsPerSegment; // 5 segmentos grandes

    if (ultValueEl) {
      ultValueEl.textContent = `${currentUnits}/${totalUnits}`;
    }

    // largura contínua base (opcional)
    if (ultFillEl) {
      const percent = (currentUnits / totalUnits) * 100;
      ultFillEl.style.width = `${percent}%`;
    }

    // segmentos grandes
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

    const hpSegments = this.el.querySelector(".hp-segments");
    if (hpSegments) {
      const hpPerSegment = 50;
      const hpSegmentCount = Math.floor(this.maxHP / hpPerSegment);
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
    // SKILLS (custo de ultômetro pra ult)
    // =========================

    this.el.querySelectorAll(".skill-btn").forEach((button) => {
      const skillKey = button.dataset.skillKey;
      const skill = this.skills.find((s) => s.key === skillKey);
      if (!skill) return;

      // 🔹 Se não for ultimate, nunca é bloqueado por recurso
      if (!skill.isUltimate) {
        button.dataset.disabledByResource = "false";
        return;
      }

      const cost = this.getSkillCost(skill);
      const resourceState = this.getResourceState();

      const hasResource = context?.freeCostSkills
        ? true
        : resourceState.current >= cost;

      // 🔥 Aqui NÃO mexemos em button.disabled
      button.dataset.disabledByResource = hasResource ? "false" : "true";
    });

    // =========================
    // Status indicators
    // =========================

    StatusIndicator.updateChampionIndicators(this);
    // =========================
    // Botões das skills (bloqueio por ação já tomada)
    // =========================

    this.syncActionStateUI();
  }

  syncActionStateUI() {
    if (!this.el) return;

    const blockingKeywords = [
      "congelado",
      "paralisado",
      // futuras paralisantes aqui
    ];

    const hasHardBlock = blockingKeywords.some((keyword) =>
      this.hasKeyword(keyword),
    );

    const inerteData = this.getKeywordData("inerte");
    const isInerteBlocking = inerteData && !inerteData.canBeInterruptedByAction;

    const hasBlockingKeywords = hasHardBlock || isInerteBlocking;

    this.el.querySelectorAll(".skill-btn").forEach((btn) => {
      const disabledByResource = btn.dataset.disabledByResource === "true";
      const disabledByAction = this.hasActedThisTurn;

      btn.dataset.disabledByAction = disabledByAction ? "true" : "false";

      // 🔥 DECISÃO FINAL CENTRALIZADA
      const shouldDisable =
        disabledByResource || disabledByAction || hasBlockingKeywords;

      btn.disabled = shouldDisable;
    });
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
