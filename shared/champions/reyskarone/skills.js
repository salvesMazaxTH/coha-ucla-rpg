import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const reyskaroneSkills = [
  // =========================
  // Ataque Básico
  // =========================
  basicAttack,
  // =========================
  // Habilidades Especiais

  // =========================
  // H1 — Corte Tributário
  // =========================
  {
    key: "tributo_de_sangue",
    name: "Tributo de Sangue",
    bf: 45,
    hpSacrificePercent: 15,
    tributeDuration: 2,
    tributeHeal: 15,
    tributeBonusDamage: 10,
    contact: false,
    manaCost: 80,
    priority: 1,
    description() {
      return `Custo: ${this.manaCost} MP
      Contato: ${this.contact ? "✅" : "❌"}
      Prioridade: +${this.priority}
      BF ${this.bf}.
      Reyskarone sacrifica ${this.hpSacrificePercent}% de seu HP máximo para aplicar "Tributo" por ${this.tributeDuration} turnos.
      Aliados que atacarem o alvo curam ${this.tributeHeal} HP e causam ${this.tributeBonusDamage} de dano a mais. Além disso, ataca o alvo escolhido imediatamente após a execução da habilidade (BF ${this.bf}).`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;

      const hpSacrifice =
        Math.round((user.maxHP * (this.hpSacrificePercent / 100)) / 5) * 5;

      user.takeDamage(hpSacrifice);

      const tributeApplied = enemy.applyKeyword(
        "tributo",
        this.tributeDuration,
        context,
      );

      const result = CombatResolver.resolveDamage({
        baseDamage: (user.Attack * this.bf) / 100,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      if (result?.log && tributeApplied) {
        result.log += `\n${formatChampionName(enemy)} foi marcado com Tributo.`;
      }

      user.runtime.hookEffects ??= [];

      const effect = {
        key: "tributo_de_sangue_effect",
        expiresAt: context.currentTurn + this.tributeDuration,

        beforeDamageDealt({ dmgSrc, dmgReceiver, damage, owner, context }) {
          if (dmgReceiver !== enemy) return;
          if (dmgSrc.team !== owner.team) return;
          if (damage <= 0) return;

          // alvo não tem tributo
          if (!dmgReceiver.hasKeyword?.("tributo")) return;

          const bonus = 10; //this.tributeBonusDamage;

          return {
            damage: damage + bonus,
            log: `🩸 Tributo amplificou o golpe de ${dmgSrc.name} (+${bonus} dano)`,
          };
        },

        afterDamageDealt({ dmgSrc, dmgReceiver, context, owner }) {
          if (dmgReceiver !== enemy) return;
          if (dmgSrc.team !== owner.team) return;

          const heal = 15;
          if (heal <= 0) return;

          dmgSrc.heal(heal, context);

          return {
            log: `🩸 Tributo: ${dmgSrc.name} recuperou ${heal} HP.`,
          };
        },

        onTurnStart({ owner, context }) {
          if (context.currentTurn >= this.expiresAt) {
            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (e) => e !== this,
            );
          }
        },
      };
      
      user.runtime.hookEffects.push(effect);

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
    manaCost: 180,
    priority: 4,
    description() {
      return `Custo: ${this.manaCost} MP
       Prioridade: +${this.priority}
       Concede a um aliado:
       +${this.atkBuff} ATQ
       +${this.lifeStealBuff}% LifeSteal
       Duração: ${this.buffDuration} turnos`;
    },
    targetSpec: ["select:ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
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
    manaCost: 300,
    priority: 5,
    description() {
      return `Custo: ${this.manaCost} MP
      Prioridade: +${this.priority}
      Seleciona um aliado:
      Ele recebe:
      +${this.atkBuffPercent}% ATQ
      +${this.lifeStealBuff}% LifeSteal
      Duração: ${this.buffDuration} turnos`;
    },
    targetSpec: ["select:ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuffPercent,
        duration: this.buffDuration,
        context,
        isPercent: true,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
      });

      ally.applyKeyword("pacto_carmesim", this.pactDuration, context, {
        source: user.id,
      });

      return {
        log: `${formatChampionName(user)} selou um Pacto Carmesim com ${formatChampionName(ally)}.`,
      };
    },
  },
];

export default reyskaroneSkills;
