import { DamageEngine } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const raliaSkills = [
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
    key: "juramento_de_ferro",
    name: "Juramento de Ferro",
    description: `
    Cooldown: 1 turno,
    Contato: ❌
    BF 70.
    Ralia perde 30 de Defesa e 10 de HP (Dano Direto), para ganhar +35 de Ataque por 2 turnos.
    Em seguida, ataca um inimigo.
  `,
    contact: false,
    cooldown: 1,
    priority: 0,
    targetSpec: ["self", "enemy"],
    execute({ user, targets, context = {} }) {
      user.takeDamage(10); // dano direto

      user.modifyStat({
        statName: "Defense",
        amount: -30,
        duration: 2,
        context,
      }); // -30 Defense for 2 turns

      console.log("BEFORE SELF ATK BUFF:", user.Attack);

      user.modifyStat({ statName: "Attack", amount: 35, duration: 2, context }); // +35 Attack for 2 turns

      console.log("AFTER SELF ATK BUFF:", user.Attack);

      // Ataque básico imediato
      const { enemy } = targets;

      console.log("ATTACK BEFORE DAMAGE:", user.Attack);

      const bf = 70;
      const result = DamageEngine.resolveDamage({
        baseDamage: (user.Attack * bf) / 100,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      const userName = formatChampionName(user);
      const log = `${userName} executou Juramento de Ferro, perdendo 10 HP e 30 de Defesa, mas ganhando +35 de Ataque por 2 turnos.`;
      // colocar dentro de result.log
      result.log = log + " " + result.log;
      return result;
    },
  },

  {
    key: "sentença_de_campo",
    name: "Sentença de Campo",
    description: `
    Cooldown: 2 turnos,
    Contato: ✅
    BF 90.
    Rália se cura em 60% do dano efetivo causado
    Arredondado para o múltiplo de 5 mais próximo
    Cura mínima: 25
  `,
    contact: true,
    cooldown: 2,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 90;
      const baseDamage = (user.Attack * bf) / 100;
      const result = DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      const effectiveDamage = result.totalDamage || 0;
      const healingAmount = Math.max(
        25,
        Math.round((effectiveDamage * 0.6) / 5) * 5,
      ); // 60% do dano efetivo arredondado para múltiplo de 5, mínimo 25

      user.heal(healingAmount, context); // Cura o usuário

      // 5️⃣ Estende o log da engine (não substitui)
      const userName = formatChampionName(user);
      result.log += `\n${userName} se curou em ${healingAmount} HP.`;

      // 6️⃣ Retorna o objeto COMPLETO
      return result;
    },
  },

  {
    key: "decreto_do_bastiao",
    name: "Decreto do Bastião",
    description: `Decreto do Bastião
      Cooldown: 2 turnos
      Prioridade: +1
      Contato: ❌
      BF 85.
      Rália finca sua lâmina no chão e impõe sua lei ao campo.
      Ao ativar, por 2 turnos (inclui o atual):
      1️⃣ Zona de Contestação
      Inimigos ativos sofrem:
      −20 de Ataque
      2️⃣ Golpe de Retaliação:
      Ralia executa um ataque automático contra todos os inimigos vivos imediatamente (dano = BF 85 como Dano Direto).
`,
    contact: false,
    cooldown: 2,
    priority: 1,
    targetSpec: ["all-enemies"],
    execute({ user, context = {} }) {
      // Pegar todos os inimigos (time diferente do usuário)
      const enemies = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((champion) => champion.team !== user.team && champion.alive);

      const bf = 85;
      const baseDamage = (user.Attack * bf) / 100;

      const results = [];

      // Aplicar dano em cada inimigo
      enemies.forEach((enemy) => {
        const damageResult = DamageEngine.resolveDamage({
          baseDamage,
          mode: "hybrid", // 'hybrid' para Dano Direto puro ou Direto + bruto
          directDamage: baseDamage, // Dano Direto puro
          user,
          target: enemy,
          skill: this.name,
          context,
          allChampions: context?.allChampions,
        });
        enemy.modifyStat({
          statName: "Attack",
          amount: -20,
          duration: 2,
          context,
        }); // -20 Attack por 2 turnos

        results.push(damageResult);
      });

      return results;
    },
  },
];

export default raliaSkills;
