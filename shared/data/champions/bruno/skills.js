import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicBlock from "../basicBlock.js";

const brunoSkills = [
  // ========================
  // Bloqueio Básico (global)
  // ========================
  basicBlock,

  // ========================
  // Habilidades Especiais
  // ========================

  // ========================
  // H1 - Toque Congelante
  // ========================
  {
    key: "toque_congelante",
    name: "Toque Congelante",
    bf: 55,
    geladoDuration: 2,
    contact: true,
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
      // Garante que 30% exato do HP seja considerado low life (ex: 95/315)
      const lowLifeThreshold = Math.ceil(target.maxHP * 0.3);
      const isLowHP = target.HP <= lowLifeThreshold;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
        ...(isLowHP ? { critOptions: { force: true } } : {}),
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
      const lowLifeThreshold = Math.ceil(target.maxHP * 0.3);
      const isLowHP = target.HP <= lowLifeThreshold;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
        ...(isLowHP ? { critOptions: { force: true } } : {}),
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
      const lowLifeThreshold = Math.ceil(target.maxHP * 0.3);
      const isLowHP = target.HP <= lowLifeThreshold;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
        ...(isLowHP ? { critOptions: { force: true } } : {}),
      }).execute();

      if (!result?.evaded && !result?.immune) {
        target.applyStatusEffect("gelado", this.geladoDuration, context);
      }

      return result;
    },
  },
];

export default brunoSkills;
