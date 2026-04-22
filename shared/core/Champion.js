// Import status effect methods
import {
  applyStatusEffect,
  hasStatusEffect,
  getStatusEffect,
  getStatusEffectData,
  removeStatusEffect,
  purgeExpiredStatusEffects,
} from "./championStatus.js";

// Import combat methods
import {
  roundToFive,
  addShield,
  _checkAndConsumeShieldBlock,
  applyTaunt,
  isTauntedBy,
  applyDamageReduction,
  getTotalDamageReduction,
  applyStatModifier,
  buffStat,
  debuffStat,
  modifyStat,
  modifyHP,
  takeDamage,
  heal,
  purgeExpiredStatModifiers,
  purgeExpiredHookEffects,
  addDamageModifier,
  purgeExpiredModifiers,
  getDamageModifiers,
} from "./championCombat.js";

// Import UI methods
import {
  renderChampion,
  updateChampionUI,
  syncChampionActionStateUI,
  destroyChampion,
} from "./championUI.js";

import { formatChampionName } from "../ui/formatters.js";

export class Champion {
  constructor(data = {}) {
    const { identity = {}, stats = {}, combat = {}, runtime = {} } = data;

    // IDENTIDADE
    this.id = identity.id;
    this.name = identity.name;
    this.portrait = identity.portrait;
    this.team = identity.team;
    this.combatSlot = Number.isInteger(identity.combatSlot)
      ? identity.combatSlot
      : null;
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
      : 24; // Padrão de 6 barras (24 unidades internas)
    this.ultMeter = 0;

    this.initializeResources(stats);

    // COMBATE
    this.skills = combat.skills;
    this.passive = combat.passive || null;
    this.damageModifiers = [];
    this.statModifiers = [];
    this.tauntEffects = [];
    this.damageReductionModifiers = [];
    this.statusEffects = new Map();
    this.alive = true;
    this.hasActedThisTurn = false;

    // RUNTIME
    this.runtime = this.buildRuntime(runtime);
  }

  static fromBaseData(baseData, id, team, { combatSlot = null } = {}) {
    const champ = new Champion({
      identity: {
        id,
        name: baseData.name,
        portrait: baseData.portrait,
        team,
        combatSlot,
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

    champ.runtime ??= {};
    champ.runtime.hookEffects ??= [];

    // INJETAR IMUNIDADE ELEMENTAL AUTOMÁTICA
    if (champ.elementalAffinities?.length) {
      champ.runtime.hookEffects.push({
        key: "elemental_affinity_immunity",
        group: "system",

        hookScope: {
          onStatusEffectIncoming: "target",
        },

        onStatusEffectIncoming({ target, statusEffect }) {
          console.log(
            "IMMUNITY TEST",
            target.name,
            target.elementalAffinities,
            statusEffect.subtypes,
          );
          const affinities = target.elementalAffinities || [];
          const effectElements = statusEffect.subtypes || [];

          if (effectElements.some((e) => affinities.includes(e))) {
            return {
              cancel: true,
              message: `${formatChampionName(target)} é imune a <b>${statusEffect.name}</b>!`,
            };
          }
        },
      });
    }

    return champ;
  }

  // Método para serializar o estado do campeão
  serialize() {
    return {
      id: this.id,
      championKey:
        this.championKey ??
        (typeof this.id === "string" && this.id.includes("-")
          ? this.id.split("-")[0]
          : this.name),

      team: this.team,
      combatSlot: this.combatSlot,

      name: this.name,
      portrait: this.portrait,
      entityType: this.entityType,

      passive: {
        name: this.passive?.name ?? null,
        description: (() => {
          const d = this.passive?.description;
          if (!d) return "";
          return typeof d === "function"
            ? d.call(this.passive, this)
            : String(d);
        })(),
      },

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

        // Strip functions and object references that could cause circular refs
        for (const k of Object.keys(clone)) {
          const v = clone[k];
          if (typeof v === "function") {
            delete clone[k];
          } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            // Allow only plain-data objects (shields array is fine via Array.isArray above)
            // Deep-clone to sever any live references
            try {
              clone[k] = JSON.parse(JSON.stringify(v));
            } catch {
              delete clone[k];
            }
          }
        }

        return clone;
      })(),

      // Data-only keys for client-side indicator/UI logic.
      // Never serialize hook functions or full hook objects.
      runtimeHookEffectKeys: (() => {
        const hooks = Array.isArray(this.runtime?.hookEffects)
          ? this.runtime.hookEffects
          : [];

        return hooks
          .map((effect) =>
            typeof effect?.key === "string" ? effect.key.toLowerCase() : null,
          )
          .filter(Boolean);
      })(),

      statusEffects: Array.from(this.statusEffects.entries()).map(
        ([key, value]) => {
          const safeValue = { ...value };

          // Strip raw metadata (may contain live champion/context references)
          delete safeValue.metadata;

          if (safeValue.source && typeof safeValue.source === "object") {
            safeValue.source = {
              id: safeValue.source.id,
              name: safeValue.source.name,
            };
          }

          // Strip functions (hooks not needed by client)
          for (const k of Object.keys(safeValue)) {
            if (typeof safeValue[k] === "function") {
              delete safeValue[k];
            }
          }

          return [key, safeValue];
        },
      ),

      // Modifier counts for UI indicators (buff/debuff arrows)
      statModifiers: (this.statModifiers || []).map((m) => ({
        amount: m.amount,
        statName: m.statName,
        isPermanent: m.isPermanent,
      })),
      damageModifiersCount: (this.damageModifiers || []).length,
      damageReductionModifiersCount: (this.damageReductionModifiers || [])
        .length,

      // Taunt effects for UI indicator (provocação)
      tauntEffects: (this.tauntEffects || []).map((t) => ({
        taunterId: t.taunterId,
        expiresAtTurn: t.expiresAtTurn,
      })),
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

  // Operações públicas
  getSkillCost(skill) {
    if (!skill) return 0;
    if (skill.isUltimate !== true) return 0;
    if (!Number.isInteger(skill.ultCost) || skill.ultCost <= 0) return 0;
    return skill.ultCost * 4; // Converte barras para unidades internas
  }

  addUlt(input) {
    const amount = typeof input === "object" ? input.amount : Number(input);
    if (!Number.isInteger(amount) || amount <= 0) return 0;

    return this._applyUltDelta(amount);
  }

  spendUlt(cost) {
    const amount = Math.abs(Number(cost) || 0);
    if (this.ultMeter < amount) return 0;

    return this._applyUltDelta(-amount);
  }

  // Núcleo interno
  _applyUltDelta(delta) {
    /* console.log(
      "APPLY DELTA",
      this.name,
      "instance:",
      this.id,
      "delta:",
      delta,
      "antes:",
      this.ultMeter,
    );
    */
    if (!Number.isInteger(delta) || delta === 0) return 0;

    const next = Math.max(0, Math.min(this.ultCap, this.ultMeter + delta));
    const applied = next - this.ultMeter;

    this.ultMeter = next;
    return applied;
  }

  // Compatibilidade (LEGACY API)
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
  // ======== RUNTIME ========
  // ===============================

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

  // ===============================
  // ======== STATUS EFFECTS (Delegated) ========
  // ===============================

  applyStatusEffect(
    statusEffectKey,
    duration,
    context,
    metadata = {},
    stackCount = 1,
  ) {
    return applyStatusEffect(
      this,
      statusEffectKey,
      duration,
      context,
      metadata,
      stackCount,
    );
  }

  hasStatusEffect(statusEffectKey) {
    return hasStatusEffect(this, statusEffectKey);
  }

  getStatusEffectData(statusEffectKey) {
    return getStatusEffectData(this, statusEffectKey);
  }

  getStatusEffect(statusEffectKey) {
    return getStatusEffect(this, statusEffectKey);
  }

  removeStatusEffect(statusEffectKey) {
    return removeStatusEffect(this, statusEffectKey);
  }

  purgeExpiredStatusEffects(currentTurn) {
    return purgeExpiredStatusEffects(this, currentTurn);
  }

  // ===============================
  // ======== ACTION MARKING ========
  // ===============================

  markActionTaken() {
    this.hasActedThisTurn = true;
  }

  resetActionStatus() {
    this.hasActedThisTurn = false;
    this.syncActionStateUI();
  }

  // ===============================
  // ======== COMBAT (Delegated) ====
  // ===============================

  roundToFive(x) {
    return roundToFive(x);
  }

  modifyStat(config = {}) {
    return modifyStat(this, config);
  }

  applyStatModifier(config = {}) {
    return applyStatModifier(this, config);
  }

  buffStat(config = {}) {
    return buffStat(this, config);
  }

  debuffStat(config = {}) {
    return debuffStat(this, config);
  }

  modifyHP(amount, config = {}) {
    return modifyHP(this, amount, config);
  }

  _checkAndConsumeShieldBlock(context, damageType) {
    return _checkAndConsumeShieldBlock(this, context, damageType);
  }

  addShield(amount, decayPerTurn = 0, context, type = "regular") {
    return addShield(this, amount, decayPerTurn, context, type);
  }

  applyTaunt(taunterId, duration, context) {
    return applyTaunt(this, taunterId, duration, context);
  }

  isTauntedBy(taunterId) {
    return isTauntedBy(this, taunterId);
  }

  applyDamageReduction(config) {
    if (typeof config !== "object") {
      throw new Error(`[applyDamageReduction] config inválido: ${config}`);
    }
    return applyDamageReduction(this, config);
  }

  getTotalDamageReduction() {
    return getTotalDamageReduction(this);
  }

  purgeExpiredStatModifiers(currentTurn) {
    return purgeExpiredStatModifiers(this, currentTurn);
  }

  purgeExpiredHookEffects(currentTurn) {
    return purgeExpiredHookEffects(this, currentTurn);
  }

  takeDamage(amount, context) {
    return takeDamage(this, amount, context);
  }

  heal(amount, context, options = {}) {
    return heal(this, amount, context, this, options);
  }

  addDamageModifier(mod) {
    return addDamageModifier(this, mod);
  }

  purgeExpiredModifiers(currentTurn) {
    return purgeExpiredModifiers(this, currentTurn);
  }

  getDamageModifiers() {
    return getDamageModifiers(this);
  }

  // ===============================
  // ======== UI (Delegated) ========
  // ===============================

  render(container, handlers = {}) {
    return renderChampion(this, container, handlers);
  }

  updateUI(context) {
    return updateChampionUI(this, context);
  }

  syncActionStateUI() {
    return syncChampionActionStateUI(this);
  }

  destroy() {
    return destroyChampion(this);
  }
}
