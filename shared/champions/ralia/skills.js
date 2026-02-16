import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const raliaSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    bf: 60,
    contact: true,
    cooldown: 0,
    priority: 0,
    description() {
      return `O ataque básico genérico (${this.cooldown} cooldown, BF ${this.bf}).
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
    key: "juramento_de_ferro",
    name: "Juramento de Ferro",
    bf: 60,
    selfDamage: 10,
    defLoss: 30,
    atkBuff: 35,
    buffDuration: 2,
    contact: false,
    cooldown: 1,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turno
        Contato: ${this.contact ? "✅" : "❌"}
        BF ${this.bf}.
        Ralia perde ${this.defLoss} de Defesa e ${this.selfDamage} de HP (Dano Direto), para ganhar +${this.atkBuff} de Ataque por ${this.buffDuration} turnos.
        Em seguida, ataca um inimigo.`;
    },
    targetSpec: ["self", "enemy"],
    execute({ user, targets, context = {} }) {
      user.takeDamage(this.selfDamage);

      user.modifyStat({
        statName: "Defense",
        amount: -this.defLoss,
        duration: this.buffDuration,
        context,
      });

      console.log("BEFORE SELF ATK BUFF:", user.Attack);

      user.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
      });

      console.log("AFTER SELF ATK BUFF:", user.Attack);

      // Ataque básico imediato
      const { enemy } = targets;

      console.log("ATTACK BEFORE DAMAGE:", user.Attack);

      const userName = formatChampionName(user);
      const selfLog = `${userName} executou Juramento de Ferro, perdendo ${this.selfDamage} HP e ${this.defLoss} de Defesa, mas ganhando +${this.atkBuff} de Ataque por ${this.buffDuration} turnos.`;

      if (!enemy) {
        return { log: selfLog };
      }

      const result = CombatResolver.resolveDamage({
        baseDamage: (user.Attack * this.bf) / 100,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      // colocar dentro de result.log
      result.log = selfLog + " " + result.log;
      return result;
    },
  },

  {
    key: "sentença_de_campo",
    name: "Sentença de Campo",
    bf: 90,
    healPercent: 60,
    minHeal: 25,
    contact: true,
    cooldown: 2,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turnos
        Contato: ${this.contact ? "✅" : "❌"}
        BF ${this.bf}.
        Rália se cura em ${this.healPercent}% do dano efetivo causado
        Arredondado para o múltiplo de 5 mais próximo
        Cura mínima: ${this.minHeal}`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const result = CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      const effectiveDamage = result.totalDamage || 0;
      const healingAmount = Math.max(
        this.minHeal,
        Math.round((effectiveDamage * (this.healPercent / 100)) / 5) * 5,
      );

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
    bf: 85,
    atkDebuff: 20,
    debuffDuration: 2,
    contact: false,
    cooldown: 2,
    priority: 1,
    description() {
      return `Cooldown: ${this.cooldown} turnos
Prioridade: +${this.priority}
Contato: ${this.contact ? "✅" : "❌"}
BF ${this.bf}.
Rália finca sua lâmina no chão e impõe sua lei ao campo.
Ao ativar, por ${this.debuffDuration} turnos (inclui o atual):
1️⃣ Zona de Contestação
Inimigos ativos sofrem:
−${this.atkDebuff} de Ataque
2️⃣ Golpe de Retaliação:
Ralia executa um ataque automático contra todos os inimigos vivos imediatamente (dano = BF ${this.bf} como Dano Direto).`;
    },
    targetSpec: ["all-enemies"],
    execute({ user, context = {} }) {
      // Pegar todos os inimigos (time diferente do usuário)
      const enemies = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((champion) => champion.team !== user.team && champion.alive);

      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      // Aplicar dano em cada inimigo
      enemies.forEach((enemy) => {
        const damageResult = CombatResolver.resolveDamage({
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
          amount: -this.atkDebuff,
          duration: this.debuffDuration,
          context,
        }); // -20 Attack por 2 turnos

        results.push(damageResult);
      });

      return results;
    },
  },
];

export default raliaSkills;
