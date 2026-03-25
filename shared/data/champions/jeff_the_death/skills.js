import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const jeffTheDeathSkills = [
  // =========================
  // Ataque Básico
  // =========================

  basicStrike,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "golpe_funebre",
    name: "Golpe Fúnebre",

    bf: 35,
    contact: true,
    damageMode: "piercing",
    priority: 0,

    description() {
      return `Jeff causa dano perfurante no alvo inimigo escolhido. Se Jeff já morreu, esta habilidade também causa dano aos campeões adjacentes.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime.deathCounter ??= 0;

      const results = [];

      // 🎯 PRIMARY
      const primaryResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPortion: baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(primaryResult);

      // 🧠 Se não tiver stacks, acabou
      if (user.runtime.deathCounter <= 0) return results;

      const adjacentEnemies = context.getAdjacentChampions(enemy) || [];

      // 🎯 Para cada adjacente, cria um resultado
      for (const adjEnemy of adjacentEnemies) {
        const result = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPortion: baseDamage,
          attacker: user,
          defender: adjEnemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(result);
      }

      return results;
    },
  },

  {
    key: "abraço_da_morte",
    name: "Abraço da Morte",

    bf: 30,
    damageMode: "standard",

    markDuration: 2,
    rewardAttack: 20, // porcentagem de buff permanente por morte do inimigo marcado
    punishPercent: 0.2, // porcentagem da vida atual como dano adicional por turno se o inimigo não morrer

    contact: false,
    priority: 1,

    description() {
      return `Causa dano e marca o alvo por ${this.markDuration} turno(s).
      Se o alvo morrer enquanto marcado, Jeff recebe +${this.rewardAttack}% de Ataque permanentemente.
      Caso contrário, o alvo sofre dano adicional equivalente a ${this.punishPercent * 100}% da vida atual por turno.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime.deathCounter ??= 0;

      // Marcar o inimigo
      enemy.runtime.markedByAbraçoDaMorte = true;

      const punishDamage = enemy.HP * this.punishPercent;
      const rewardAttack = this.rewardAttack;

      enemy.runtime.hookEffects ??= [];
      enemy.runtime.hookEffects.push({
        key: "abraco_da_morte_mark",
        expiresAtTurn: context.currentTurn + this.markDuration,

        onTurnStart({ owner, context }) {
          if (!owner.runtime.markedByAbraçoDaMorte) return;
          if (this.expiresAtTurn < context.currentTurn) {
            owner.runtime.markedByAbraçoDaMorte = false;
            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== "abraco_da_morte_mark",
            );
            return;
          }

          context.isDot = true;

          new DamageEvent({
            baseDamage: punishDamage,
            mode: DamageEvent.Modes.ABSOLUTE,
            attacker: null,
            defender: owner,
            skill: {
              key: "abraco_da_morte_punish",
              contact: false,
              damageMode: "absolute",
            },
            context,
            allChampions: context?.allChampions,
          }).execute();
        },
      });

      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects.push({
        key: "abraco_da_morte_buff",
        expiresAtTurn: context.currentTurn + this.markDuration,

        onChampionDeath({ deadChampion, context }) {
          if (deadChampion !== enemy) return;

          // Recompensa: Jeff ganha buff permanente
          user.modifyStat({
            statName: "Attack",
            amount: rewardAttack,
            isPermanent: true,
            context,
          });

          user.runtime.hookEffects = user.runtime.hookEffects.filter(
            (he) => he.key !== "abraco_da_morte_buff",
          );
        },

        onTurnStart({ owner, context }) {
          if (this.expiresAtTurn < context.currentTurn) {
            user.runtime.hookEffects = user.runtime.hookEffects.filter(
              (he) => he.key !== "abraco_da_morte_buff",
            );
          }
        },
        //return ??;
      });
    },
  },
];

export default jeffTheDeathSkills;
