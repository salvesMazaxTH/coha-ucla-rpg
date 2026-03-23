import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const gryskarchuSkills = [
  // =========================
  // Bloqueio Básico (global)
  // =========================

  basicBlock,
  // =========================
  // Habilidades Especiais
  // =========================

  {
    key: "raizes_da_terra",
    name: "Raízes da Terra",
    bf: 75,
    damageMode: "standard",
    rootDuration: 2,
    contact: false,

    priority: 0,
    description() {
      return `Causa dano ao inimigo e aplica "Enraizado" por ${this.rootDuration} turnos.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const rooted = enemy.applyStatusEffect(
        "enraizado",
        this.rootDuration,
        context,
      );

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
      if (rooted && result?.log) {
        result.log += `\n${enemy.name} foi Enraizado!`;
      }
      return result;
    },
  },

  {
    key: "florescimento_vital",
    name: "Florescimento Vital",
    healAmount: 40,
    contact: false,

    priority: 0,
    description() {
      return `Gryskarchu cura a si e todos os aliados ativos em ${this.healAmount} HP.`;
    },
    targetSpec: ["all:ally"],
    resolve({ user, targets, context }) {
      let someoneHealed = false;

      for (const target of targets) {
        if (!target.alive) continue;
        if (target.team !== user.team) continue;

        target.heal(this.healAmount, context, user);
        someoneHealed = true;
      }

      return {
        log: someoneHealed
          ? `${formatChampionName(user)} evocou Florescimento Vital.`
          : `${formatChampionName(user)} evocou Florescimento Vital, mas ninguém precisava de cura.`,
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
    isUltimate: true,
    ultCost: 2,

    priority: 5,
    description() {
      return `Concede +${this.defBuff}% de DEF a si ou a um aliado por ${this.buffDuration} turnos, cura em ${this.healPercent}% do HP máximo e dá bônus de dano (+${this.defDamageBonus}% da DEF) por ${this.buffDuration} turnos.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context }) {
      const [ally] = targets;
      let healAmount = ally.maxHP * (this.healPercent / 100);

      ally.heal(healAmount, context, user);
      ally.modifyStat({
        statName: "Defense",
        amount: this.defBuff,
        duration: this.buffDuration,
        context,
        isPercent: true,
      });

      const bonus = ally.Defense * (this.defDamageBonus / 100);

      ally.addDamageModifier({
        id: "proteção_da_mãe_terra",
        expiresAtTurn: context.currentTurn + this.buffDuration,

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
