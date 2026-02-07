import { DamageEngine } from "../core/damageEngine.js";

const vaelSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, Dano = 100% ATQ).`,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = user.Attack;
      return DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
    },
  },
  {
    key: "corte_instantaneo",
    name: "Corte Instantâneo",
    description: `
    Cooldown: 1 turno,
    Contato: ✅
    Dano:
    Base 15 + ATQ;
    📌 Pode critar normalmente
`,
    cooldown: 1,
    priority: 0, // Example priority for testing
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = 15 + user.Attack;
      return DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
    },
  },
  {
    key: "investida_transpassante",
    name: "Investida Transpassante",
    description: `Cooldown: 2 turnos
       Contato: ✅
       Dano: 
       Alvo primário → Base 20 + ATQ;
       Alvo secundário → Base 10 + metade do ATQ;
       ❌ O alvo primário NUNCA pode ser atingido por Acerto Crítico
      (Esta habilidade ignora todos os modificadores de Crítico no alvo principal)
      ✅ O alvo secundário SEMPRE sofre Acerto Crítico`,
    cooldown: 2,
    priority: 0, // Example priority for testing
    targetSpec: [
  { type: "enemy", unique: true },
  { type: "enemy", unique: true }
],

    execute({ user, targets, context }) {
      const { enemy: primary, enemy2: secondary } = targets;

      const baseDamage = 20 + user.Attack;
      const results = [];

      const primaryResult = DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: primary,
        skill: this.name,
        context,
        options: { disable: true }, // sem crítico
      });

      results.push(primaryResult);

      if (secondary) {
        const secondaryResult = DamageEngine.resolveRaw({
          baseDamage: Math.round(baseDamage / 2),
          user,
          target: secondary,
          skill: this.name,
          context,
          options: { force: true }, // crítico garantido
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
       Dano: 
       Base 40 + 2×ATQ (180) = 220
       `,
    cooldown: 3,
    priority: 0, // Example priority for testing
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = 40 + 2 * user.Attack;

      return DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
    },
  },
];

export default vaelSkills;
