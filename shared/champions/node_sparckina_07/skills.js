import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const nodeSparckina07Skills = [
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "sparkling_slash",
    name: "Sparkling Slash",
    bf: 70,
    contact: true,
    energyCost: 140,
    priority: 0,
    element: "lightning",
    description() {
      return `Causa dano bruto ao inimigo.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
    },
  },

  {
    key: "radiant_Rush",
    name: "Radiant Rush",
    speedBuff: 15,
    evasionPercent: 10,
    buffDuration: 2,
    contact: false,
    energyCost: 100,
    priority: 0,
    element: "lightning",
    description() {
      return `Aumenta a Velocidade em ${this.speedBuff} e a Esquiva em ${this.evasionPercent}% da Velocidade por ${this.buffDuration} turnos.`;
    },
    targetSpec: ["self"],
    execute({ user, context = {} }) {
      user.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffDuration,
        context,
      });

      // buffar a ESQ depois de buffar a VEL para garantir que o aumento de ESQ seja baseado na VEL atualizada
      const evasionBuff = Math.round(user.Speed * (this.evasionPercent / 100));

      user.modifyStat({
        statName: "Evasion",
        amount: evasionBuff,
        duration: this.buffDuration,
        context,
      });

      return {
        log: `${formatChampionName(user)} acelera radiante (+${this.speedBuff} VEL, +${evasionBuff} ESQ).`,
      };
    },
  },

  {
    // Ultimate
    key: "radiant_burst",
    name: "Radiant Burst",
    bf: 135,
    paralyzeDuration: 2,
    contact: true,
    energyCost: 420,
    priority: 0,
    element: "lightning",
    description() {
      return `Causa alto dano bruto ao inimigo (BF ${this.bf}) e aplica paralisia por ${this.paralyzeDuration} turnos.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const paralyzed = enemy.applyKeyword(
        "paralisado",
        this.paralyzeDuration,
        context,
      );

      if (!paralyzed) {
        console.log(
          `[HABILIDADE — Radiant Burst] ${formatChampionName(user)} tentou aplicar "Paralisado" em ${formatChampionName(enemy)}, mas falhou.`,
        );
      }

      return CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
    },
  },
];

export default nodeSparckina07Skills;
