import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicBlock from "../basicBlock.js";

const brunoSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  basicBlock,

  // ========================
  // Habilidades Especiais
  // ========================

  // ========================
  // H1 - Míssil de Gelo
  // ========================
  {
    key: "missil_de_gelo",
    name: "Míssil de Gelo",
    bf: 55,
    geladoDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return `Causa dano ao inimigo e o deixa Gelado por ${this.geladoDuration} turno(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!result?.evaded && !result?.immune) {
        target.applyStatusEffect("gelado", this.geladoDuration, context);
      }

      return result;
    },
  },

  // ========================
  // H2 - Investida Glacial
  // ========================
  {
    key: "investida_glacial",
    name: "Investida Glacial",
    bf: 90,
    contact: true,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return `Avança sobre o inimigo com força glacial, causando dano.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // Ultimate - Tempestade de Gelo
  // ========================
  {
    key: "tempestade_de_gelo",
    name: "Tempestade de Gelo",
    bf: 120,
    geladoDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    ultCost: 3,
    element: "ice",

    description() {
      return `Desencadeia uma tempestade de gelo sobre o inimigo, causando dano devastador e o Gelando por ${this.geladoDuration} turno(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!result?.evaded && !result?.immune) {
        target.applyStatusEffect("gelado", this.geladoDuration, context);
      }

      return result;
    },
  },
];

export default brunoSkills;
