import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "sede_de_sangue",
  name: "Sede de Sangue",

  lifeStealPerProc: 3,
  awakenLifeStealThreshold: 40,
  lifeStealTierSize: 5,
  damageBonusPerTierPercent: 10,
  piercingPerTierPercent: 2.5,
  damageReductionPerTierPercent: 3,
  permanentDamageModifierId: "drex_sede_de_sangue_scaling",
  damageReductionSource: "drex_sede_de_sangue_scaling",
  pseudoPermanentDurationTurns: 9999,

  description() {
    return `Ganha +${this.lifeStealPerProc}% de Roubo de Vida permanente sempre que um aliado aplica Sangramento ou sempre que um inimigo sofre dano de Sangramento. Ao atingir ${this.awakenLifeStealThreshold}%+ de Roubo de Vida pela primeira vez, desperta um bônus permanente: para cada ${this.lifeStealTierSize}% de Roubo de Vida atual, recebe +${this.damageBonusPerTierPercent}% de dano aumentado, converte dano padrão em perfurante com ${this.piercingPerTierPercent}% de perfuração e ganha ${this.damageReductionPerTierPercent}% de Redução de Dano (atualizada sempre que ganhar Roubo de Vida).`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBuffingStat: undefined,
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  onStatusEffectApplied({ source, statusEffectKey, owner, context }) {
    if (statusEffectKey !== "bleeding") return;
    if (!source || source.team !== owner.team) return;

    const result = owner.modifyStat({
      statName: "LifeSteal",
      amount: this.lifeStealPerProc,
      context,
      isPermanent: true,
      ignoreMinimum: true,
      statModifierSrc: source,
    });

    if (!result?.appliedAmount) return;

    const logs = [
      `[PASSIVA — ${this.name}] ${formatChampionName(owner)} se alimenta do Sangramento de ${formatChampionName(source)} (+${result.appliedAmount}% Roubo de Vida permanente).`,
    ];

    const awakenResult = this._tryAwaken({ owner, context });
    if (awakenResult?.log) logs.push(awakenResult.log);

    return {
      log: logs,
    };
  },

  onAfterDmgTaking({ defender, skill, owner, context }) {
    if (!context?.isDot) return;
    if (skill?.key !== "bleeding_tick") return;
    if (!defender || defender.team === owner.team) return;

    const result = owner.modifyStat({
      statName: "LifeSteal",
      amount: this.lifeStealPerProc,
      context,
      isPermanent: true,
      ignoreMinimum: true,
      statModifierSrc: defender,
    });

    if (!result?.appliedAmount) return;

    const logs = [
      `[PASSIVA — ${this.name}] ${formatChampionName(owner)} absorve o Sangramento de ${formatChampionName(defender)} (+${result.appliedAmount}% Roubo de Vida permanente).`,
    ];

    const awakenResult = this._tryAwaken({ owner, context });
    if (awakenResult?.log) logs.push(awakenResult.log);

    return {
      log: logs,
    };
  },

  onBuffingStat({ owner, statName, buffTarget, context }) {
    if (statName !== "LifeSteal") return;
    if (!owner || !buffTarget || buffTarget.id !== owner.id) return;

    const awakenResult = this._tryAwaken({ owner, context });

    if (!this._isAwakened(owner)) return awakenResult;

    const refreshResult = this._refreshDamageReduction({ owner, context });

    const logs = [];
    if (awakenResult?.log) logs.push(awakenResult.log);
    if (refreshResult?.log) logs.push(refreshResult.log);

    if (!logs.length) return;

    return {
      log: logs,
    };
  },

  onBeforeDmgDealing({ attacker, owner, mode }) {
    if (attacker !== owner) return;
    if (!this._isAwakened(owner)) return;
    if (mode && mode !== "standard") return;

    const tiers = this._getLifeStealTiers(owner);
    if (tiers <= 0) return;

    return {
      mode: "piercing",
      piercingPercentage: Math.min(100, tiers * this.piercingPerTierPercent),
    };
  },

  _isAwakened(owner) {
    return !!owner?.runtime?.drexBloodAscension?.awakened;
  },

  _getLifeStealTiers(owner) {
    const ls = Number(owner?.LifeSteal || 0);
    return Math.max(0, Math.floor(ls / this.lifeStealTierSize));
  },

  _ensureDamageModifier(owner) {
    const alreadyHasModifier = owner
      .getDamageModifiers()
      .some((modifier) => modifier.id === this.permanentDamageModifierId);

    if (alreadyHasModifier) return;

    owner.addDamageModifier({
      id: this.permanentDamageModifierId,
      name: "Sede de Sangue (Escalonamento)",
      permanent: true,
      apply: ({ baseDamage, attacker }) => {
        const tiers = Math.max(
          0,
          Math.floor(Number(attacker?.LifeSteal || 0) / this.lifeStealTierSize),
        );
        if (tiers <= 0) return baseDamage;

        const bonusPercent = tiers * this.damageBonusPerTierPercent;
        return baseDamage * (1 + bonusPercent / 100);
      },
    });
  },

  _refreshDamageReduction({ owner, context }) {
    if (!owner || !context) return;

    owner.damageReductionModifiers = owner.damageReductionModifiers.filter(
      (modifier) => modifier?.source !== this.damageReductionSource,
    );

    const tiers = this._getLifeStealTiers(owner);
    const amount = tiers * this.damageReductionPerTierPercent;

    if (amount <= 0) return;

    owner.applyDamageReduction({
      amount,
      duration: this.pseudoPermanentDurationTurns,
      type: "percent",
      source: this.damageReductionSource,
      context,
    });

    return {
      log: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} recalibra sua resistência (${amount}% de Redução de Dano).`,
    };
  },

  _tryAwaken({ owner, context }) {
    if (!owner) return;

    owner.runtime ??= {};
    owner.runtime.drexBloodAscension ??= {
      awakened: false,
    };

    if (owner.runtime.drexBloodAscension.awakened) return;
    if (Number(owner.LifeSteal || 0) < this.awakenLifeStealThreshold) return;

    owner.runtime.drexBloodAscension.awakened = true;

    this._ensureDamageModifier(owner);
    this._refreshDamageReduction({ owner, context });

    return {
      log: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} ultrapassa ${this.awakenLifeStealThreshold}% de Roubo de Vida e entra em Frenesi Carmesim permanente!`,
    };
  },
};
