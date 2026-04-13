import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicBlock from "../basicBlock.js";

const kaeldrathVulcanoSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  basicBlock,

  // ========================
  // Habilidades Especiais
  // ========================

  // ========================
  // H1- Pancada Vulcânica
  // ========================

  {
    key: "pancada_vulcanica",
    name: "Pancada Vulcânica",
    bf: 60,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Causa dano normal ao inimigo.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      return result;
    },
  },

  // ========================
  // H2 - Bola de Magma
  // ========================
  {
    key: "bola_de_magma",
    name: "Bola de Magma",
    bf: 70,
    burnDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,

    element: "fire",

    description() {
      return `Causa dano ao inimigo, aplicando Queimando por ${this.burnDuration} turnos. A explosão também acerta o inimigo à direita do alvo, caso exista, causando metade do dano EFETIVAMENTE causado ao alvo principal.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const primaryResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(primaryResult);

      if (
        !primaryResult?.evaded &&
        !primaryResult?.immune &&
        primaryResult.totalDamage > 0
      )
        enemy.applyStatusEffect("queimando", this.burnDuration, context);

      const [secondaryTarget] = context.getAdjacentChampions(enemy, {
        side: "right",
      });

      console.log(
        "[BOLA DE MAGMA] Alvos adjacentes encontrados:",
        secondaryTarget,
      );

      if (!secondaryTarget) return results;

      console.log(
        `[BOLA DE MAGMA] Dano causado ao alvo principal: ${primaryResult.totalDamage}`,
      );

      /*       if (!context.damageDepth) context.damageDepth = 1; */

      const splashDamage = primaryResult.totalDamage / 2;
      // dano secundário é igual à metade do dano causado no alvo principal

      const secondaryResult = new DamageEvent({
        baseDamage: splashDamage || 0,
        attacker: user,
        defender: secondaryTarget,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(secondaryResult);

      return results;
    },
  },

  // ========================
  // Ultimate — Destruição Vulcânica
  // ========================
  {
    key: "destruicao_vulcanica",
    name: "Destruição Vulcânica",
    bf: 95,
    reductedDamagePercent: 30,

    damageMode: "standard",

    isUltimate: true,
    ultCost: 3,

    contact: false,
    priority: 0,

    element: "fire",

    description() {
      return `Causa dano a TODOS os personagens; aqueles com 'Afinidade: Fogo', 'Água' ou 'Terra' recebem apenas ${this.reductedDamagePercent}% do dano.`;
    },

    targetSpec: ["all"],

    resolve({ user, targets, context }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const targetList = Array.isArray(targets)
        ? targets
        : targets
          ? [targets]
          : [];

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (!target?.alive) continue;

        const affinities = target.elementalAffinities || [];
        // só os aliados que possuem afinidade com fogo, água ou terra recebem dano reduzido

        let finalBaseDamage = baseDamage;

        if (
          affinities.includes("fire") ||
          affinities.includes("water") ||
          affinities.includes("earth")
        )
          finalBaseDamage = baseDamage * (this.reductedDamagePercent / 100);

        const result = new DamageEvent({
          baseDamage: finalBaseDamage,
          attacker: user,
          defender: target,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      return results;
    },
  },
];

export default kaeldrathVulcanoSkills;
