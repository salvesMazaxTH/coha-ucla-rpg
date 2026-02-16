import { DamageEngine } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const gryskarchuSkills = [
  // =========================
  // Ataque Básico
  // =========================
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    bf: 60,
    contact: true,
    cooldown: 0,
    priority: 0,
    description() {
      return `Ataque padrão (BF ${this.bf}).
Contato: ${this.contact ? "✅" : "❌"}`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return DamageEngine.resolveDamage({
        baseDamage,
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
    bf: 75,
    rootDuration: 2,
    contact: false,
    cooldown: 1,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turno
Contato: ${this.contact ? "✅" : "❌"}
Efeitos:
Dano Bruto = BF ${this.bf}
Aplica "Enraizado" por ${this.rootDuration} turnos.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const rooted = enemy.applyKeyword(
        "enraizado",
        this.rootDuration,
        context,
      );

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
    healAmount: 50,
    contact: false,
    cooldown: 1,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turno
Efeitos:
Gryskarchu cura a si e a todos os aliados ativos.
Cura = ${this.healAmount} HP`;
    },
    targetSpec: ["all:ally"],
    execute({ user, targets, context }) {
      const healAmount = this.healAmount;
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
    // 30% hp máx como cura , +25% DEF, CD 2, PARA O ALIADO
    key: "proteção_da_mãe_terra",
    name: "Proteção da Mãe Terra",
    defBuff: 25,
    healPercent: 30,
    buffDuration: 2,
    defDamageBonus: 35,
    contact: false,
    cooldown: 2,
    priority: 5,
    description() {
      return `Cooldown: ${this.cooldown} turnos
Prioridade: +${this.priority}
Efeitos:
Gryskarchu concede +${this.defBuff}% de DEF a si ou a um aliado ativo por ${this.buffDuration} turnos e o cura em ${this.healPercent}% do HP máximo. Além disso, o aliado recebe um bônus de +${this.defDamageBonus}% da DEF no dano causado por ${this.buffDuration} turnos.`;
    },
    targetSpec: ["select:ally"],
    execute({ user, targets, context }) {
      const { ally } = targets;
      let healAmount = Math.floor(ally.maxHP * (this.healPercent / 100));
      healAmount = Math.round(healAmount / 5) * 5;

      ally.heal(healAmount, context);
      ally.modifyStat({
        statName: "Defense",
        amount: this.defBuff,
        duration: this.buffDuration,
        context,
        isPercent: true,
      });

      const bonus =
        Math.round(Math.floor(ally.Defense * (this.defDamageBonus / 100)) / 5) *
        5;

      ally.addDamageModifer({
        id: "proteção_da_mãe_terra",
        expiresAt: context.currentTurn + this.buffDuration,

        apply({ baseDamage, user }) {
          const total = baseDamage + bonus;
          return total;
        },
      });

      return {
        log: `${formatChampionName(user)} concede a ${formatChampionName(ally)} ${healAmount} de cura e +${this.defBuff}% DEF por ${this.buffDuration} turnos!`,
      };
    },
  },
];

export default gryskarchuSkills;
