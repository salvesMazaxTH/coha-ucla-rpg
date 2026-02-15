import { DamageEngine } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const gryskarchuSkills = [
  // =========================
  // Ataque Básico
  // =========================
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `Ataque padrão (100% ATQ).
    Contato: ✅`,
    contact: true,
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
     Contato: ❌
     Efeitos:
     Dano Bruto = BF 90
     Aplica "Enraizado" por 2 turnos.`,
    contact: false,
    cooldown: 1,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const bf = 90;
      const baseDamage = (user.Attack * bf) / 100;

      const rooted = enemy.applyKeyword("enraizado", 2, context);

      const result = DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      if (rooted && result?.log) {
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
    contact: false,
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
    Prioridade: +5
      Efeitos:
      Gryskarchu concede +35% de DEF a si ou a um aliado ativo por 2 turnos e o cura em 40% do HP máximo.`,
    contact: false,
    cooldown: 2,
    priority: 5,
    targetSpec: ["select:ally"],
    execute({ user, targets }) {
      const { ally } = targets;
      let healAmount = Math.floor(ally.maxHP * 0.4);
      let defenseBuff = Math.floor(ally.Defense * 0.35);

      healAmount = Math.round(healAmount / 5) * 5;
      defenseBuff = Math.round(defenseBuff / 5) * 5;

      ally.heal(healAmount, context);
      ally.modifyStat({
        statName: "Defense",
        amount: defenseBuff,
        duration: 2,
        context,
      });

      return {
        log: `${formatChampionName(user)} concede a ${formatChampionName(ally)} ${healAmount} de cura e +${defenseBuff} DEF por 2 turnos!`,
      };
    },
  },
];

export default gryskarchuSkills;
