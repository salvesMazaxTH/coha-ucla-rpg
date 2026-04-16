import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicBlock from "../basicBlock.js";

const torrenSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "espada_estrondeante",
    name: "Espada Estrondeante",
    bf: 50,
    contact: true,
    damageMode: "standard",
    priority: 0,
    description() {
      return `Causa dano ao inimigo escolhido e atordoa um outro inimigo aleatório.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageEvent = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const otherEnemies = context?.allChampions
        ? Array.from(context.allChampions.values()).filter(
            (champion) =>
              champion.team !== user.team &&
              champion.id !== enemy.id &&
              champion.isAlive?.(),
          )
        : [];

      if (!otherEnemies.length) return damageEvent;

      const randomEnemy =
        otherEnemies[Math.floor(Math.random() * otherEnemies.length)];
      randomEnemy.applyStatusEffect("atordoado", 1, context, {
        source: {
          type: "skill",
          skill: this,
          champion: user,
        },
      });

      return damageEvent;
    },
  },

  {
    key: "desprezar_os_fracos",
    name: "Desprezar os Fracos",

    bf: 40,
    contact: true,
    damageMode: "piercing",
    piercingPercentage: 100,
    priority: 2,

    tauntDuration: 2,

    description() {
      return `Causa dano perfurante (${this.piercingPercentage}% de perfuração) ao inimigo com menor ataque e aplica provocação nele por ${this.tauntDuration} turno(s).`;
    },
    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const weakestEnemy = targets.reduce((weakest, target) => {
        if (!weakest || target.Attack < weakest.Attack) {
          return target;
        }
        return weakest;
      }, null);

      const damageEvent = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: weakestEnemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const tauntLog = weakestEnemy.applyTaunt(
        user.id,
        this.tauntDuration,
        context,
      );

      // Return both damage and taunt log if present
      return tauntLog ? [damageEvent, tauntLog] : damageEvent;
    },
  },

  {
    key: "juggernaut",
    name: "Juggernaut",

    bf: 115,
    contact: true,
    damageMode: "standard",

    isUltimate: true,
    ultCost: 3,

    stunDuration: 2,

    priority: 0,
    description() {
      return `Causa dano ao inimigo e atordoa por ${this.stunDuration} turno(s).`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageEvent = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      enemy.applyStatusEffect("atordoado", this.stunDuration, context, {
        source: {
          type: "skill",
          skill: this,
          champion: user,
        },
      });

      return damageEvent;
    },
  },
];

export default torrenSkills;
