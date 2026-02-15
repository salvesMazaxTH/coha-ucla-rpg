import { DamageEngine } from "../../core/combatResolver.js";

const vaelSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, BF 100).
    Contato: ✅`,
    contact: true,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 100;
      const baseDamage = (user.Attack * bf) / 100;
      return DamageEngine.resolveDamage({
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
    description: `
    Cooldown: 1 turno,
    Contato: ✅
    BF 115.
    📌 Pode critar normalmente
  `,
    contact: true,
    cooldown: 1,
    priority: 0, // Example priority for testing
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 115;
      const baseDamage = (user.Attack * bf) / 100;
      return DamageEngine.resolveDamage({
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
    description: `Cooldown: 2 turnos
       Contato: ✅
       BF 80 (primario) / BF 85 (secundario).
       ❌ O alvo primário NUNCA pode ser atingido por Acerto Crítico
      (Esta habilidade ignora todos os modificadores de Crítico no alvo principal)
      ✅ O alvo secundário SEMPRE sofre Acerto Crítico`,
    contact: true,
    cooldown: 2,
    priority: 0, // Example priority for testing
    targetSpec: [
      { type: "enemy", unique: true },
      { type: "enemy", unique: true },
    ],

    execute({ user, targets, context = {} }) {
      const { enemy: primary, enemy2: secondary } = targets;

      const bfPrimary = 80;
      const baseDamage = (user.Attack * bfPrimary) / 100;
      const results = [];

      const primaryResult = DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: primary,
        skill: this.name,
        context,
        options: { disable: true }, // sem crítico
        allChampions: context?.allChampions,
      });

      results.push(primaryResult);

      if (secondary) {
        const secondaryResult = DamageEngine.resolveDamage({
          baseDamage: (user.Attack * 85) / 100,
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
    description: `Cooldown: 3 turnos
       Contato: ✅
       BF 235.
       `,
    contact: true,
    cooldown: 3,
    priority: 0, // Example priority for testing
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 235;
      const baseDamage = (user.Attack * bf) / 100;

      return DamageEngine.resolveDamage({
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
