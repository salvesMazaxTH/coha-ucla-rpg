import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const vaelSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "corte_instantaneo",
    name: "Corte Instantâneo",
    bf: 65,
    contact: true,
    energyCost: 120,
    priority: 0,
    description() {
      return `Ataque rápido com chance de crítico.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
    },
  },
  {
    key: "investida_transpassante",
    name: "Investida Transpassante",
    bfPrimary: 55,
    bfSecondary: 60,
    contact: true,
    energyCost: 200,
    priority: 0,
    description() {
      return `Ataque duplo: primário sem crítico, secundário crítico garantido.`;
    },
    targetSpec: [
      { type: "enemy", unique: true },
      { type: "enemy", unique: true },
    ],

    execute({ user, targets, context = {} }) {
      const { enemy: primary, enemy2: secondary } = targets;

      const baseDamage = (user.Attack * this.bfPrimary) / 100;
      const results = [];

      if (primary) {
        const primaryResult = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target: primary,
          skill: this,
          context,
          options: { disable: true }, // sem crítico
          allChampions: context?.allChampions,
        });
        results.push(primaryResult);
      }

      if (secondary) {
        const secondaryResult = CombatResolver.processDamageEvent({
          baseDamage: (user.Attack * this.bfSecondary) / 100,
          user,
          target: secondary,
          skill: this,
          context,
          options: { force: true }, // crítico garantido
          allChampions: context?.allChampions,
        });
        results.push(secondaryResult);
      }

      return results;
    },
  },

  {
    key: "veredito_do_fio_silencioso",
    name: "Veredito do Fio Silencioso",
    bf: 145,
    contact: true,
    energyCost: 420,
    priority: 0,
    description() {
      return `Ataque final devastador.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
    },
  },
];

export default vaelSkills;
