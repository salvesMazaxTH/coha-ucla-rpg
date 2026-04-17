import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const reyskaroneSkills = [
  // =========================
  // Bloqueio Total (global)
  // =========================
  basicBlock,
  // =========================
  // Habilidades Especiais

  // =========================
  // H1 — Corte Tributário
  // =========================
  {
    key: "tributoDeSangue",
    name: "Tributo de Sangue",
    bf: 45,
    damageMode: "standard",
    hpSacrificePercent: 15,
    tributeDuration: 2,
    tributeHeal: 15,
    tributeBonusDamage: 10,
    contact: false,

    priority: 1,
    description() {
      return `Sacrifica ${this.hpSacrificePercent}% do HP máximo e marca o alvo com Tributo por ${this.tributeDuration} turnos (a marca é bloqueada por Imunidade Absoluta, Escudo Supremo ou Escudo de Feitiço). Aliados que o atacarem curam ${this.tributeHeal} HP e causam +${this.tributeBonusDamage} de dano. Em seguida, ataca o alvo.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const hpSacrifice = user.maxHP * (this.hpSacrificePercent / 100);

      user.takeDamage(hpSacrifice);

      enemy.runtime.hookEffects ??= [];
      const shields = Array.isArray(enemy.runtime?.shields)
        ? enemy.runtime.shields
        : [];

      const hasImunidadeAbsoluta = enemy.hasStatusEffect?.("imunidadeAbsoluta");
      const supremeShieldIdx = shields.findIndex(
        (shield) => shield?.type === "supreme" && shield?.amount > 0,
      );
      const spellShieldIdx = shields.findIndex(
        (shield) => shield?.type === "spell" && shield?.amount > 0,
      );

      const tributoBlocked =
        hasImunidadeAbsoluta ||
        supremeShieldIdx !== -1 ||
        spellShieldIdx !== -1;

      if (!tributoBlocked) {
        // =========================
        // HOOK TEMPORÁRIO: TRIBUTO
        // =========================
        enemy.runtime.hookEffects.push({
          key: "tributo",
          group: "skill",

          expiresAtTurn: context.currentTurn + this.tributeDuration,

          hookScope: {
            onAfterDmgDealing: "defender",
          },

          onBeforeDmgDealing: ({
            attacker,
            defender,
            skill,
            damage,
            owner,
            context,
          }) => {
            if (defender !== enemy) return;

            // bônus de dano
            const bonusDamage = this.tributeBonusDamage;

            return {
              damage: damage + bonusDamage,
            };
          },

          onAfterDmgDealing: ({ attacker, defender, owner, context }) => {
            if (defender !== enemy) return;

            // cura o atacante
            attacker.heal(this.tributeHeal, context, owner);
          },
        });

        context.registerDialog({
          message: `${formatChampionName(enemy)} foi marcado com <b>Tributo</b>!`,
          sourceId: user.id,
          targetId: enemy.id,
          duration: 1000,
        });
      } else {
        if (supremeShieldIdx !== -1) {
          shields.splice(supremeShieldIdx, 1);
        } else if (spellShieldIdx !== -1) {
          shields.splice(spellShieldIdx, 1);
        }
      }

      // ataque imediato
      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!tributoBlocked) {
        if (result?.log) {
          result.log += `\n${formatChampionName(enemy)} foi marcado com Tributo.`;
        }
      }

      return result;
    },
  },

  // =========================
  // H2 — Transfusão Marcial
  // =========================
  {
    key: "transfusao_marcial",
    name: "Transfusão Marcial",
    atkBuff: 20,
    lifeStealBuff: 15,
    buffDuration: 2,
    contact: false,

    priority: 4,
    description() {
      return `Concede a um aliado: +${this.atkBuff} ATQ, +${this.lifeStealBuff}% LifeSteal por ${this.buffDuration} turnos.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log:
          user === ally
            ? `${formatChampionName(user)} fortaleceu-se com Transfusão Marcial.`
            : `${formatChampionName(user)} fortaleceu ${formatChampionName(ally)} com Transfusão Marcial.`,
      };
    },
  },

  // =========================
  // ULT — Pacto Carmesim
  // =========================
  {
    key: "pacto_carmesim",
    name: "Pacto Carmesim",
    atkBuffPercent: 18,
    lifeStealBuff: 30,
    buffDuration: 2,
    pactDuration: 3,
    contact: false,
    isUltimate: true,
    ultCost: 3,

    priority: 5,
    description() {
      return `Seleciona um aliado: ele recebe +${this.atkBuffPercent}% ATQ e +${this.lifeStealBuff}% LifeSteal por ${this.buffDuration} turnos.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuffPercent,
        duration: this.buffDuration,
        context,
        isPercent: true,
        statModifierSrc: user,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log: `${formatChampionName(user)} selou um Pacto Carmesim com ${formatChampionName(ally)}.`,
      };
    },
  },
];

export default reyskaroneSkills;
