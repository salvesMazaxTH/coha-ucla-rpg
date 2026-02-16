import { DamageEngine } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const tharoxSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, BF 60).
    Contato: ✅`,
    contact: true,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 60;
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
    contact: false,
    cooldown: 1,
    priority: 2,
    targetSpec: ["self"],
    execute({ user, targets, context = {} }) {
      const provokeDuration = 1; // Provoke lasts for 1 turn (current turn only)
      const damageReductionAmount = 20; // 20 raw damage reduction
      const damageReductionDuration = 2; // Damage reduction lasts for 2 turns (current + next)

      // Apply damage reduction to Tharox
      user.applyDamageReduction({
        damageReductionAmount,
        damageReductionDuration,
        context,
      });

      // Get all active champions on the opposing team
      const enemyChampions = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((c) => c.team !== user.team && c.alive);

      enemyChampions.forEach((enemy) => {
        enemy.applyProvoke(user.id, provokeDuration, context);
      });

      const userName = formatChampionName(user);
      return {
        log: `${userName} executou Provocação Primeva. Todos os inimigos foram provocados e ${userName} recebeu -${damageReductionAmount} de Dano Bruto Final.`,
      };
    },
  },

  {
    key: "impacto_da_couraça",
    name: "Impacto da Couraça",
    description: `Cooldown: 1 turno,
    Contato: Sim
    Dano:
    BF 80 + 20% DEF`,
    contact: true,
    cooldown: 2,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 80;
      const baseDamage = (user.Attack * bf) / 100 + user.Defense / 5;
      const result = DamageEngine.resolveDamage({
        user,
        baseDamage,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
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
    5 HP para cada +5 DEF adicional que ele tiver acima da DEF base (205)
    Enquanto estiver ativo:
    Ataques que causam dano passam a causar um bônus de dano igual a 45% da DEF atual de Tharox (com um teto de 80 de dano adicional).`,
    contact: false,
    cooldown: 3,
    priority: 0,
    targetSpec: ["self"],
    execute({ user, context = {} }) {
      user.modifyHP(50, { maxHPOnly: true }); // Aumenta HP máximo em 50
      user.modifyStat({
        statName: "Defense",
        amount: 10,
        context,
        isPermanent: true,
      }); // Aumenta DEF permanentemente
      const proportionalHeal = Math.floor((user.Defense - 205) / 5) * 5; // Calcula cura proporcional
      user.heal(proportionalHeal, context); // Cura o usuário com base na DEF atual

      // Aplica o modificador de dano permanentemente
      user.addDamageModifier({
        id: "apoteose-do-monolito",
        name: "Bônus de Apoteose do Monólito",
        expiresAtTurn: context.currentTurn + 3, // Dura para o turno atual e os próximos 3 turnos, casando com a volta do cooldown

        apply: ({ baseDamage, user }) => {
          const bonus = Math.min(Math.floor(user.Defense * 0.45), 80); // Bônus de dano é 45% da DEF atual, com um teto de 80 de dano adicional
          return baseDamage + bonus;
        },
      });

      const userName = formatChampionName(user);
      return {
        log: `${userName} executou Apoteose do Monólito, liberando sua forma de guerra. Ganhou +${10} Defesa e +50 HP Máximo. Além disso, curou ${proportionalHeal} HP! (Defense: ${user.Defense}, HP: ${user.HP}/${user.maxHP})`,
      };
    },
  },
];

export default tharoxSkills;
