import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const eliasCrossSkills = [
  // =========================
  // Ataque Básico
  // =========================
  basicAttack,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "impacto_relampago",
    name: "Impacto Relâmpago",
    bf: 80,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    damageBonusMode: "absolute",
    priority: 0,
    description() {
      return `Se o alvo tiver "Sobrecarga", causa ${this.damageBonus} de dano absoluto a mais`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const isOverloaded = enemy.hasKeyword("sobrecarga");

      const results = [];

      const pushResult = (r) => {
        if (Array.isArray(r)) results.push(...r);
        else if (r) results.push(r);
      };

      const firstResult = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      pushResult(firstResult);

      if (isOverloaded) {
        const extraDamage = this.damageBonus;
        context.extraDamageQueue.push({
          baseDamage: extraDamage,
          mode: "absolute",
          user,
          target: enemy,
          skill: this,
          context,          allChampions: context?.allChampions,
        });
             }

      return results;
    },
  },

  {
    key: "2nd_skill",
    name: "2nd Skill",
    bf: 25,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    damageBonusMode: "absolute",
    priority: 0,
    description() {
      return `Elias Cross ganha +35% de chance na passiva no próximo turno apenas. Se o alvo tiver "Sobrecarga", causa ${this.damageBonus} de dano absoluto a mais.`;
    },
    targetSpec: ["enemy", "self"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      //user.addBuff({ lógica do buff aqui, duração: 1 turno, tipo: "chancePassiva" });

      const baseDamage = (user.Attack * this.bf) / 100;
      const isOverloaded = enemy.hasKeyword("sobrecarga");

      const results = [];

      const pushResult = (r) => {
        if (Array.isArray(r)) results.push(...r);
        else if (r) results.push(r);
      };

      const firstResult = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      pushResult(firstResult);

      if (isOverloaded) {
        const extraDamage = this.damageBonus;
        const secondResult = CombatResolver.processDamageEvent({
          baseDamage: extraDamage,
          mode: "absolute",
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        pushResult(secondResult);
      }

      return results;
    },
  },

  {
    key: "tempestade_de_raios",
    name: "Tempestade de Raios",
    bf: 135,
    damageMode: "standard",
    isUltimate: true,
    ultCost: 3,
    recoilDamage: 40,
    recoilDamageMode: "absolute",
    contact: false,
    priority: 0,
    description() {
      return `Causa dano a TODOS os personagens, não afeta o próprio Elias e nem aliados com 'Afinidade: Raio' ou 'Terra'. No entanto, Elias sofre ${this.recoilDamage} de dano absoluto de recuo.`;
    },
    targetSpec: ["all"],
    execute({ user, targets, context }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      for (const target of context.allChampions ?? []) {
        if (target === user) continue;

        const affinities = target.elementalAffinities || [];
        if (affinities.includes("raio") || affinities.includes("terra"))
          continue;

        const result = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      context.extraDamageQueue.push({
        baseDamage: this.recoilDamage,
        mode: "absolute",
        user,
        target: user,
        skill: this,
      });

      return results;
    },
  },
];

export default eliasCrossSkills;
