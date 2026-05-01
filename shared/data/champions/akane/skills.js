import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";

const akaneSkills = [
  totalBlock,

  // ========================
  // Skill 1 — ataque padrão
  // ========================
  {
    key: "corte_carmesim",
    name: "Corte Carmesim",
    bf: 65,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Causa dano ao inimigo.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

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

  // ========================
  // Skill 2 — lifesteal (forma correta)
  // ========================
  {
    key: "banho_de_sangue",
    name: "Banho de Sangue",
    lifeStealBuff: 95,
    buffDuration: 2,
    priority: 0,

    description() {
      return `Ganha ${this.lifeStealBuff}% de Roubo de Vida por ${this.buffDuration} turno(s).`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return null;
    },
  },

  // ========================
  // Ultimate
  // ========================
  {
    key: "massacre_escarlate",
    name: "Massacre Escarlate",
    bf: 95,
    contact: true,
    damageMode: "standard",
    isUltimate: true,
    ultCost: 3,
    priority: 0,

    description() {
      return `Causa dano elevado ao inimigo.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

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
];

export default akaneSkills;
