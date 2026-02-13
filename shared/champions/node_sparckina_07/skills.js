import { DamageEngine } from "../../core/damageEngine.js";
import { formatChampionName } from "../../core/formatters.js";

const nodeSparckina07Skills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, BF 100).`,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 100;
      const baseDamage = (user.Attack * bf) / 100;
      return DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },

  {
    key: "sparkling_slash",
    name: "Sparkling Slash",
    description: `Cooldown: 2 turnos
     Efeitos:
     Dano Bruto = BF 125
     `,
    cooldown: 2,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 125;
      const baseDamage = (user.Attack * bf) / 100;
      return DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },

  {
    key: "radiant_Rush",
    name: "Radiant Rush",
    description: `Cooldown: 2 turnos
     Efeitos:
     Ganha +15 VEL e 10% da VEL como ESQ.
     `,
    cooldown: 2,
    priority: 0, // Default priority
    targetSpec: ["self"],
    execute({ user, context = {} }) {
      const speedBuff = 15;
      const evasionBuff = Math.round(user.Speed * 0.1);

      user.modifyStat({
        statName: "Speed",
        amount: speedBuff,
        duration: 2,
        context,
      });

      user.modifyStat({
        statName: "Evasion",
        amount: evasionBuff,
        duration: 2,
        context,
      });

      return {
        log: `${formatChampionName(user)} acelera radiante (+${speedBuff} VEL, +${evasionBuff} ESQ).`,
      };
    },
  },

  {
    // Ultimate
    key: "radiant_burst",
    name: "Radiant Burst",
    description: `Cooldown: 3 turnos
     Efeitos:
     Dano Bruto = BF 225
     100% de chance de aplicar "Paralisado" no alvo inimigo.
     `,
    cooldown: 3,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 225;
      const baseDamage = (user.Attack * bf) / 100;

      enemy.applyKeyword("paralisado", 2, context);

      return DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },
];

export default nodeSparckina07Skills;
