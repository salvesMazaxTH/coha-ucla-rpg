import { DamageEngine } from "../core/damageEngine.js";

const raliaSkills = [
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
    key: "juramento_de_ferro",
    name: "Juramento de Ferro",
    description: `
    Cooldown: 1 turno,
    Contato: ❌
    Ralia perde 30 de Defesa e 10 de HP (Dano Direto), para ganhar +35 de Ataque por 2 turnos.
    Em seguida, executa um Ataque Básico em um inimigo.
`,
    cooldown: 1,
    priority: 0,
    targetSpec: ["self", "enemy"],
    execute({ user, targets, context }) {
      user.takeDamage(10); // dano direto

      user.modifyStat("Defense", -30, 2, context); // -30 Defense for 2 turns
      user.modifyStat("Attack", 35, 2, context); // +35 Attack for 2 turns
      const { enemy } = targets;
      const result = DamageEngine.resolveRaw({
        baseDamage: user.Attack,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
      const log = `${user.name} executou Juramento de Ferro, perdendo 10 HP e 30 de Defesa, mas ganhando +35 de Ataque por 2 turnos.`
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
    Dano: Base → 50 + ATQ
    Rália se cura em 60% do dano efetivo causado
    Arredondado para o múltiplo de 5 mais próximo
    Cura mínima: 25
`,
    cooldown: 2,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = 50 + user.Attack;
      const result = DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
      const effectiveDamage = result.totalDamage || 0;
      const healingAmount = Math.max(
        25,
        Math.round((effectiveDamage * 0.6) / 5) * 5,
      ); // 60% do dano efetivo arredondado para múltiplo de 5, mínimo 25

      user.heal(healingAmount);

      // 5️⃣ Estende o log da engine (não substitui)
      result.log += ` ${user.name} se curou em ${healingAmount} HP.`;

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
      Rália finca sua lâmina no chão e impõe sua lei ao campo.
      Ao ativar, por 2 turnos (inclui o atual):
      1️⃣ Zona de Contestação
      Inimigos ativos sofrem:
      −20 de Ataque
      2️⃣ Golpe de Retaliação:
      Ralia executa um ataque automático contra todos os inimigos vivos imediatamente (dano = 133% ATQ como Dano Direto).
`,
    cooldown: 2,
    priority: 1,
    targetSpec: ["all-enemies"],
    execute({ user, context, allChampions }) {
      // Pegar todos os inimigos (time diferente do usuário)
      const enemies = Array.from(allChampions.values()).filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = 1.33 * user.Attack;

      const results = [];

      // Aplicar dano em cada inimigo
      enemies.forEach((enemy) => {
        const damageResult = DamageEngine.resolveHybrid({
          baseDamage,
          directDamage: baseDamage,
          user,
          target: enemy,
          skill: this.name,
          context,
        });
        enemy.modifyStat("Attack", -20, 2, context); // -20 Attack por 2 turnos

        results.push(damageResult);
      });

      return results
    },
  },
];

export default raliaSkills;
