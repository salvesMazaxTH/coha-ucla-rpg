import { DamageEngine } from "../../core/damageEngine.js";
import { formatChampionName } from "../../core/formatters.js";

const gryskarchuSkills = [
  // =========================
  // Ataque Básico
  // =========================
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `Ataque padrão (100% ATQ).`,
    cooldown: 0,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      return DamageEngine.resolveDamage({
        baseDamage: user.Attack,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
    },
  },

  {
    key: "raizes_da_terra",
    name: "Raízes da Terra",
    description: `Cooldown: 1 turno
     Efeitos:
     Dano Bruto = BF 115
     Aplica "Enraizado" por 2 turnos.`,
    cooldown: 1,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const bf = 115;
      const baseDamage = (user.Attack * bf) / 100;

      enemy.applyKeyword("enraizado", 2, context);

      const result = DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      if (result?.log) {
        result.log += `\n${enemy.name} foi Enraizado!`;
      }
      return result;
    },
  },

  {
    key: "florescimento_vital",
    name: "Florescimento Vital",
    description: `Cooldown: 1 turno
     Efeitos:
     Gryskarchu cura a si e a todos os aliados ativos.
     Cura = 50 HP`,
    cooldown: 1,
    priority: 0,
    targetSpec: ["all:ally"],
    execute({ user, targets, context }) {
      const healAmount = 50;
      const healed = [];

      context.aliveChampions.forEach((champ) => {
        if (champ.team === user.team) {
          const before = champ.HP;
          champ.heal(healAmount, context);

          const gained = champ.HP - before;
          if (gained > 0) {
            healed.push(`${formatChampionName(champ)} (+${gained})`);
          }
        }
      });

      if (healed.length === 0) {
        return {
          log: `${formatChampionName(user)} evocou Florescimento Vital, mas ninguém precisava de cura.`,
        };
      }

      return {
        log: `${formatChampionName(user)} fez florescer energia vital:\n${healed.join("\n")}`,
      };
    },
  },

  {
    // 40% hp máx como cura , +35% DEF, CD 2, PARA O ALIADO
    key: "proteção_da_mãe_terra",
    name: "Proteção da Mãe Terra",
    description: `Cooldown: 2 turnos
        Efeitos:
        Gryskarchu concede a um aliado ativo 40% do HP máximo de cura e +35% de DEF por 2 turnos.`,
    cooldown: 2,
    priority: 0,
    targetSpec: ["ally"],
    execute({ user, targets, context }) {
      const { ally } = targets;
      const healAmount = Math.floor(ally.maxHP * 0.4);
      const defenseBuff = Math.floor(ally.Defense * 0.35);

      ally.heal(healAmount, context);
      ally.modifyStat("Defense", defenseBuff, 2, context);

      return {
        log: `${formatChampionName(user)} concede a ${formatChampionName(ally)} ${healAmount} de cura e +${defenseBuff} DEF por 2 turnos!`,
      };
    },
  },
];

export default gryskarchuSkills;
