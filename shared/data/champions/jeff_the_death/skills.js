import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const jeffTheDeathSkills = [
  // =========================
  // Bloqueio Total (global)
  // =========================
  basicBlock,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "golpe_funebre",
    name: "Golpe Fúnebre",

    bf: 55,
    contact: true,
    damageMode: "piercing",
    piercingPercentage: 70, // 70% de perfuração (ignora 70% da Defesa do inimigo)
    priority: 0,

    description() {
      return `Jeff causa dano perfurante (${this.piercingPercentage}% de perfuração) no alvo inimigo escolhido. Se Jeff já morreu, esta habilidade também causa dano aos campeões adjacentes.`;
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
        piercingPercentage: this.piercingPercentage,
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
          piercingPercentage: this.piercingPercentage,
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

    bf: 40,
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

      const damageResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

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
          context.damageDepth = 1;

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
      });

      return damageResult;
    },
  },

  {
    key: "inevitabilidade_da_morte",
    name: "Inevitabilidade da Morte",
    bf: 50,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    ultCost: 3,

    priority: 0,

    threshold: 0.25,
    // porcentagem de HP para ativar a execução (25%)
    description() {
      return `Jeff causa dano moderado ao alvo e o marca para morrer. No início do próximo turno, se o alvo estiver abaixo de ${this.threshold * 100}% de HP, a Morte o reclama!`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const threshold = this.threshold;
      const triggerTurn = (context.currentTurn ?? 0) + 1;
      enemy.runtime.markedByInevitabilidadeDaMorte = true;

      // Hook interno da lógica de "execução inevitável"
      const hook = {
        key: "death_claim_execution",
        group: "deathClaim",
        triggerTurn,

        priority: -999, // se implementar

        onTurnStart({ owner, context }) {
          if (!owner.alive) {
            owner.runtime.markedByInevitabilidadeDaMorte = false;
            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== "death_claim_execution",
            );
            return;
          }

          // Checa uma única vez: no início do turno seguinte ao da aplicação (X+1)
          if (context.currentTurn !== this.triggerTurn) return;

          if (owner.HP / owner.maxHP <= threshold) {
            owner.runtime.deathClaimTriggered = true;

            owner.HP = 0;
            owner.alive = false;

            // Caso execute, limpa imediatamente (alvo será removido no processamento de mortes)
            owner.runtime.markedByInevitabilidadeDaMorte = false;
            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== "death_claim_execution",
            );
          }
        },

        onTurnEnd({ owner, context }) {
          // Se não executou no check, expira visual/backend no fim do mesmo turno (X+1)
          if (context.currentTurn !== this.triggerTurn) return;

          owner.runtime.markedByInevitabilidadeDaMorte = false;
          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (he) => he.key !== "death_claim_execution",
          );
        },
      };
      console.log(
        `[JEFF][INEVITABILIDADE DA MORTE] Hook de execução a ser registrado para ${formatChampionName(enemy.name)}. hook: `,
        hook,
      );
      enemy.runtime.hookEffects ??= [];
      enemy.runtime.hookEffects.push(hook);
      console.log(
        `[JEFF][INEVITABILIDADE DA MORTE] Hook registrado. hookEffects atuais de ${formatChampionName(enemy.name)}: `,
        enemy.runtime.hookEffects,
      );

      return damageResult;
    },
  },
];

export default jeffTheDeathSkills;
