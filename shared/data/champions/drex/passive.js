import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "sede_de_sangue",
  name: "Sede de Sangue",

  lsPerProc: 3,
  awakenThreshold: 40,
  lsTierSize: 5,
  dmgAmpPerTier: 10,
  piercingRatioPerTier: 2.5,
  dmgReductPerTier: 3,
  lsHealAmpPerTier: 12,

  permDmgModId: "drex_sede_de_sangue_scaling",
  dmgReductionSrc: "drex_sede_de_sangue_scaling",
  pseudoPermanentDurationTurns: 9999,

  description() {
    return `Ganha +${this.lsPerProc}% de Roubo de Vida permanente sempre que um aliado aplica Sangramento ou sempre que um inimigo sofre dano de Sangramento. 
    Ao atingir ${this.awakenThreshold}%+ de Roubo de Vida pela primeira vez, entra em Frenesi Carmesim permanente. 
    Para cada ${this.lsTierSize}% de Roubo de Vida atual, recebe +${this.dmgAmpPerTier}% de dano aumentado, converte dano padrão em perfurante com ${this.piercingRatioPerTier}% de perfuração, ganha ${this.dmgReductPerTier}% de Redução de Dano e amplifica em em ${this.lsHealAmpPerTier}% as curas obtidas por Roubo de Vida.`;
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
      amount: this.lsPerProc,
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
      amount: this.lsPerProc,
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

    if (!owner?.runtime?.drexBloodAscension) return awakenResult;

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
    if (!owner?.runtime?.drexBloodAscension) return;
    if (mode && mode !== "standard") return;

    const tiers = Math.max(
      0,
      Math.floor(Number(owner?.LifeSteal || 0) / this.lsTierSize),
    );
    if (tiers <= 0) return;

    return {
      mode: "piercing",
      piercingPercentage: Math.min(100, tiers * this.piercingRatioPerTier),
    };
  },

  onBeforeHealing({ owner, healTarget, amount, isLifesteal }) {
    if (healTarget !== owner) return;
    if (!isLifesteal) return;
    if (!owner?.runtime?.drexBloodAscension) return;

    const tiers = Math.max(
      0,
      Math.floor(Number(owner?.LifeSteal || 0) / this.lsTierSize),
    );

    if (tiers <= 0) return;

    return {
      amount: amount * (1 + tiers * (this.lsHealAmpPerTier / 100)),
    };
  },

  _ensureDamageModifier(owner) {
    const alreadyHasModifier = owner
      .getDamageModifiers()
      .some((modifier) => modifier.id === this.permDmgModId);

    if (alreadyHasModifier) return;

    owner.addDamageModifier({
      id: this.permDmgModId,
      name: "Sede de Sangue (Escalonamento)",
      permanent: true,
      apply: ({ baseDamage, attacker }) => {
        const tiers = Math.max(
          0,
          Math.floor(Number(attacker?.LifeSteal || 0) / this.lsTierSize),
        );
        if (tiers <= 0) return baseDamage;

        const bonusPercent = tiers * this.dmgAmpPerTier;
        return baseDamage * (1 + bonusPercent / 100);
      },
    });
  },

  _refreshDamageReduction({ owner, context }) {
    if (!owner || !context) return;

    owner.damageReductionModifiers = owner.damageReductionModifiers.filter(
      (modifier) => modifier?.source !== this.dmgReductionSrc,
    );

    const tiers = Math.max(
      0,
      Math.floor(Number(owner?.LifeSteal || 0) / this.lsTierSize),
    );
    const amount = tiers * this.dmgReductPerTier;

    if (amount <= 0) return;

    owner.applyDamageReduction({
      amount,
      duration: this.pseudoPermanentDurationTurns,
      type: "percent",
      source: this.dmgReductionSrc,
      context,
    });

    return {
      log: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} recalibra sua resistência (${amount}% de Redução de Dano).`,
    };
  },

  _tryAwaken({ owner, context }) {
    if (!owner) return;

    owner.runtime ??= {};
    if (owner.runtime.drexBloodAscension) return;
    if (Number(owner.LifeSteal || 0) < this.awakenThreshold) return;

    owner.runtime.drexBloodAscension = true;

    this._ensureDamageModifier(owner);
    this._refreshDamageReduction({ owner, context });

    return {
      log: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} ultrapassa ${this.awakenThreshold}% de Roubo de Vida e entra em Frenesi Carmesim permanente!`,
    };
  },
};
