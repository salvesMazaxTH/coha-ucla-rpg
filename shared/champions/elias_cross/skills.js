import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

export const eliasCrossSkills = [
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
    damageBonus: 15,

    priority: 0,
    description() {
      return `Se o alvo tiver "Sobrecarga", causa ${this.damageBonus} de dano puro a mais`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const isOverloaded = enemy.hasKeyword("sobrecarga");

      const results = [];

      const firstResult = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      results.push(firstResult);

      if (isOverloaded) {
        const extraDamage = this.damageBonus;
        const secondResult = CombatResolver.processDamageEvent({
          baseDamage: extraDamage,
          mode: "pure",
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        results.push(secondResult);
      }

      return results;
    },
  },

  {
    key: "2nd_skill",
    name: "2nd Skill",
    bf: 25,
    contact: false,
    damageBonus: 15,
    priority: 0,
    description() {
      return `Elias Cross ganha +35% de chance na passiva no próximo turno apenas. Se o alvo tiver "Sobrecarga", causa ${this.damageBonus} de dano puro a mais.`;
    },
    targetSpec: ["enemy", "self"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      //user.addBuff({ lógica do buff aqui, duração: 1 turno, tipo: "chancePassiva" });

      const baseDamage = (user.Attack * this.bf) / 100;
      const isOverloaded = enemy.hasKeyword("sobrecarga");

      const results = [];

      const firstResult = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      results.push(firstResult);

      if (isOverloaded) {
        const extraDamage = this.damageBonus;
        const secondResult = CombatResolver.processDamageEvent({
          baseDamage: extraDamage,
          mode: "pure",
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        results.push(secondResult);
      }

      return results;
    },
  },

  {
    key: "tempestade_de_raios",
    name: "Tempestade de Raios",
    bf: 135,
    recoilDamage: 40,
    contact: false,
    priority: 0,
    description() {
      return `Causa dano a TODOS os personagens, não afeta o próprio Elias e nem aliados com 'Afinidade: Raio' ou 'Terra'". No entanto, Elias sofre ${this.recoilDamage} de dano de recuo.`;
    },
    targetSpec: ["all"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      
      const results = [];

      for (const target of context.allChampions) {
        if (target === user) continue;
        if (target.elementalAffinities.includes("lightning") || target.elementalAffinities.includes("earth")) {
          continue;
        }
        const result = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        results.push(result);
      }

      const recoilResult = CombatResolver.processDamageEvent({
        baseDamage: this.recoilDamage,
        mode: "pure",
        user,
        target: user,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
      results.push(recoilResult);

      return results;
    },
  },
];
