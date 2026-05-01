import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";

const myrraSkills = [
  totalBlock,

  {
    key: "corte_preciso",
    name: "Corte Preciso",
    bf: 65,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Causa dano que ignora reduções de dano do alvo.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      context = context || {};
      context.ignoreDamageReduction = true;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "danca_das_laminas",
    name: "Dança das Lâminas",
    hits: 2,
    bfPerHit: 40,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Ataca duas vezes. Cada golpe ativa sua passiva.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (let i = 0; i < this.hits; i++) {
        const result = new DamageEvent({
          baseDamage: (user.Attack * this.bfPerHit) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(result);
      }

      return results;
    },
  },

  {
    key: "execucao_silenciosa",
    name: "Execução Silenciosa",
    bf: 120,
    missingHpScaling: 0.5,
    contact: true,
    damageMode: "standard",
    isUltimate: true,
    ultCost: 3,
    priority: 0,

    description() {
      return `Causa dano aumentado com base na vida perdida do alvo. Ignora redução de dano.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const missingHP = enemy.maxHP - enemy.HP;
      const bonus = missingHP * this.missingHpScaling;

      context = context || {};
      context.ignoreDamageReduction = true;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100 + bonus,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default myrraSkills;
