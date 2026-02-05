import { DamageEngine } from "../core/damageEngine.js";

const tharoxSkills = [
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
    key: "provocação_primeva",
    name: "Provocação Primeva",
    description: `Cooldown: 1 turnos,
        Tharox solta um bramido bestial.
        Efeitos neste turno:
        Todos os inimigos ativos são Provocados
        → Devem mirar Tharox se causarem dano
        Tharox recebe:
        −20 de Dano Bruto Final recebido
        (respeita o Piso de 10)
        `,
    cooldown: 1,
    priority: 2,
    targetSpec: ["self"],
    execute({ user, targets, allChampions, context }) {
      const provokeDuration = 1; // Provoke lasts for 1 turn (current turn only)
      const damageReductionAmount = 20; // 20 raw damage reduction
      const damageReductionDuration = 2; // Damage reduction lasts for 2 turns (current + next)

      // Apply damage reduction to Tharox
      user.applyDamageReduction(
        damageReductionAmount,
        damageReductionDuration,
        context,
      );

      // Get all active champions on the opposing team
      const enemyChampions = Array.from(allChampions.values()).filter(
        (c) => c.team !== user.team && c.alive,
      );

      enemyChampions.forEach((enemy) => {
        enemy.applyProvoke(user.id, provokeDuration, context);
      });

      return {
        log: `${user.name} executou Provocação Primeva. Todos os inimigos foram provocados e ${user.name} recebeu -${damageReductionAmount} de Dano Bruto Final.`,
      };
    },
  },

  {
    key: "impacto_da_couraça",
    name: "Impacto da Couraça",
    description: `Cooldown: 1 turno,
    Contato: Sim
    Dano:
    Base => 15 + ATQ + 20% DEF`,
    cooldown: 2,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = 15 + user.Attack + user.Defense / 5;
      const result = DamageEngine.resolveRaw({
        user,
        baseDamage,
        target: enemy,
        skill: this.name,
        context,
      });
      return result;
    },
  },

  {
    key: "apoteose_do_monolito",
    name: "Apoteose do Monólito",
    description: `Cooldown: 3 turnos
    Tharox libera sua forma de guerra.
    Ao ativar:
    Ganha +50 HP
    Ganha +10 DEF
    Cura a si mesmo em:
    10 HP para cada +5 DEF adicional que ele tiver acima da DEF base (50)
    Enquanto estiver ativo:
    Ataques que causam dano passam a causar um bônus de dano igual a 60% da DEF atual de Tharox.`,
    cooldown: 3,
    priority: 0,
    targetSpec: ["self"],
    execute({ user, context }) {
      user.maxHP += 50; // aumentar máximo de HP
      user.heal(50); // Cura imediata de 50 HP, para refletir o aumento do máximo
      user.Defense += 10; // cura proporcional à defesa acima da base (50)
      const proportionalHeal = Math.floor((user.Defense - 50) / 5) * 10;
      user.heal(proportionalHeal);

      // Aplica o modificador de dano permanentemente
      user.addDamageModifier({
        id: "apoteose-do-monolito",

       // permanente
        permanent: true,

        apply: ({ baseDamage, user }) => {
          const bonus = Math.floor(user.Defense * 0.6);
          return baseDamage + bonus;
        },
      });

      return {
        log: `${user.name} executou Apoteose do Monólito, liberando sua forma de guerra. Defesa e HP aumentados; cura recebida; Ataques que causam dano passam a causar um bônus de 60% da Defesa.`,
      };
    },
  },
];

export default tharoxSkills;
