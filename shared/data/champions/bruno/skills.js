import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicStrike from "../basicStrike.js";

const brunoSkills = [
  // ========================
  // Golpe Básico (global)
  // ========================
  basicStrike,

  // ========================
  // Habilidades Especiais
  // ========================

  // ========================
  // H1 - Toque Congelante
  // ========================
  {
    key: "toque_congelante",
    name: "Toque Congelante",
    bf: 70,
    geladoDuration: 2,
    congeladoDuration: 1,
    contact: true,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return `Causa dano ao inimigo e o deixa Gelado por ${this.geladoDuration} turno(s). Se já estiver Gelado, torna-o Congelado por ${this.congeladoDuration} turno(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const isLowHP = target.HP < target.maxHP * 0.3;

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
        const alreadyGelado = target.hasStatusEffect("gelado");
        if (alreadyGelado) {
          target.applyStatusEffect("congelado", this.congeladoDuration, context);
        } else {
          target.applyStatusEffect("gelado", this.geladoDuration, context);
        }
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
      const isLowHP = target.HP < target.maxHP * 0.3;

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
    bf: 165,
    congeladoDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    ultCost: 3,
    element: "ice",

    description() {
      return `Desencadeia uma tempestade de gelo sobre o inimigo, causando dano devastador e o Congelando por ${this.congeladoDuration} turno(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const isLowHP = target.HP < target.maxHP * 0.3;

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
        target.applyStatusEffect("congelado", this.congeladoDuration, context);
      }

      return result;
    },
  },
];

export default brunoSkills;
