import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const nodeSparckina07Skills = [
  basicStrike,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "sparkling_slash",
    name: "Sparkling Slash",
    bf: 70,
    contact: true,
    damageMode: "standard",
    priority: 0,
    element: "lightning",
    description() {
      return `Causa dano ao inimigo.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "radiant_Rush",
    name: "Radiant Rush",
    speedBuff: 10,
    evasionPercent: 5,
    contact: false,

    priority: 3,
    element: "lightning",
    description() {
      return `Aumenta a Velocidade em ${this.speedBuff} e a Esquiva em ${this.evasionPercent}% da Velocidade.`;
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        isPermanent: true,
        context,
      });

      // buffar a ESQ depois de buffar a VEL para garantir que o aumento de ESQ seja baseado na VEL atualizada
      const evasionBuff = user.Speed * (this.evasionPercent / 100);

      user.modifyStat({
        statName: "Evasion",
        amount: evasionBuff,
        isPermanent: true,
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
    damageMode: "standard",
    priority: 0,
    element: "lightning",

    isUltimate: true,
    ultCost: 3,

    description() {
      return `Causa alto dano ao inimigo e aplica paralisia por ${this.paralyzeDuration} turnos.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const paralyzed = enemy.applyStatusEffect(
        "paralisado",
        this.paralyzeDuration,
        context,
      );

      if (!paralyzed) {
        /* console.log(
          `[HABILIDADE — Radiant Burst] ${formatChampionName(user)} tentou aplicar "Paralisado" em ${formatChampionName(enemy)}, mas falhou.`,
        );
        */
      }

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default nodeSparckina07Skills;
