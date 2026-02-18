import { CombatResolver } from "../../core/combatResolver.js";

const vaelSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    bf: 60,
    contact: true,
    energyCost: 0,
    priority: 0,
    description() {
      return `Custo: ${this.energyCost} EN
Ataque básico genérico (BF ${this.bf}).
    Contato: ${this.contact ? "✅" : "❌"}`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },
  {
    key: "corte_instantaneo",
    name: "Corte Instantâneo",
    bf: 75,
    contact: true,
    energyCost: 18,
    priority: 0,
    description() {
      return `Custo: ${this.energyCost} EN
Contato: ${this.contact ? "✅" : "❌"}
    BF ${this.bf}.
📌 Pode critar normalmente`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
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
    energyCost: 28,
    priority: 0,
    description() {
      return `Custo: ${this.energyCost} EN
Contato: ${this.contact ? "✅" : "❌"}
    BF ${this.bfPrimary} (primario) / BF ${this.bfSecondary} (secundario).
❌ O alvo primário NUNCA pode ser atingido por Acerto Crítico
(Esta habilidade ignora todos os modificadores de Crítico no alvo principal)
✅ O alvo secundário SEMPRE sofre Acerto Crítico`;
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
        const primaryResult = CombatResolver.resolveDamage({
          baseDamage,
          user,
          target: primary,
          skill: this.name,
          context,
          options: { disable: true }, // sem crítico
          allChampions: context?.allChampions,
        });
        results.push(primaryResult);
      }

      if (secondary) {
        const secondaryResult = CombatResolver.resolveDamage({
          baseDamage: (user.Attack * this.bfSecondary) / 100,
          user,
          target: secondary,
          skill: this.name,
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
    energyCost: 40,
    priority: 0,
    description() {
      return `Custo: ${this.energyCost} EN
Contato: ${this.contact ? "✅" : "❌"}
    BF ${this.bf}.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },
];

export default vaelSkills;
