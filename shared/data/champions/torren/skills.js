import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";

const torrenSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  totalBlock,
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (
        damageEvent?.evaded ||
        damageEvent?.immune ||
        !(damageEvent?.totalDamage > 0)
      ) {
        return damageEvent;
      }

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
      randomEnemy.applyStatusEffect("stunned", 1, context, {
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
      thresholdMultiplier: 1.35,
      priority: 2,

      tauntDuration: 2,

      description() {
        return `Causa dano perfurante (${this.piercingPercentage}% de perfuração) ao inimigo mais frágil.
        Se sua fragilidade for significativamente maior que a de Torren, ele é provocado por ${this.tauntDuration} turno(s) e causa menos dano a outros inimigos.`;
      },
      targetSpec: ["all:enemy"],

      resolve({ user, targets, context = {} }) {
        const baseDamage = (user.Attack * this.bf) / 100;

        const torrenScore = user.Attack / (user.HP + user.Defense);

        const scoredTargets = targets.map((t) => {
          const score = t.Attack / Math.max(1, t.HP + t.Defense);
          return { t, score };
        });

        // 🔹 sempre escolhe o mais frágil (mesmo se não passar threshold)
        const best = scoredTargets.reduce((best, curr) => {
          return !best || curr.score > best.score ? curr : best;
        }, null);

        if (!best) return null; // segurança

        const target = best.t;
        const targetScore = best.score;

        const damageEvent = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPercentage: this.piercingPercentage,
          attacker: user,
          defender: target,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        // 🔥 condição real de fraqueza
        const isWeakEnough =
          targetScore >= torrenScore * this.thresholdMultiplier;

        let tauntLog = null;

        if (isWeakEnough) {
          tauntLog = target.applyTaunt(user.id, this.tauntDuration, context);
          target.addDamageModifier({
            key: "desprezado",
            expiresAtTurn: context.currentTurn + this.tauntDuration,
            apply: ({ damage, defender }) => {
              if (!defender || defender.id !== user.id) {
                return damage * 0.7;
              }
              return damage;
            },
          });
        }

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
      return `Causa dano perfurante (${this.piercingPercentage}% de perfuração) ao inimigo mais frágil. 
      Se sua fragilidade for significativamente maior que a de Torren, ele é provocado por ${this.tauntDuration} turno(s).`;
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (
        !damageEvent?.evaded &&
        !damageEvent?.immune &&
        damageEvent?.totalDamage > 0
      ) {
        enemy.applyStatusEffect("stunned", this.stunDuration, context, {
          source: {
            type: "skill",
            skill: this,
            champion: user,
          },
        });
      }

      return damageEvent;
    },
  },
];

export default torrenSkills;
