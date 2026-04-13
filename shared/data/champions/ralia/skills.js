import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const raliaSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "juramento_de_ferro",
    name: "Juramento de Ferro",
    bf: 60,
    damageMode: "standard",
    selfDamage: 10,
    defLoss: 30,
    atkBuff: 35,
    buffDuration: 2,
    contact: false,

    priority: 0,
    description() {
      return `Ralia perde ${this.defLoss} de Defesa e ${this.selfDamage} de HP para ganhar +${this.atkBuff} de Ataque por ${this.buffDuration} turnos. Em seguida, ataca um inimigo.`;
    },
    targetSpec: ["self", "enemy"],
    resolve({ user, targets, context = {} }) {
      user.modifyStat({
        statName: "Defense",
        amount: -this.defLoss,
        duration: this.buffDuration,
        context,
      });

      user.modifyHP(-this.selfDamage, { context });

      // console.log("BEFORE SELF ATK BUFF:", user.Attack);

      user.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
      });

      // console.log("AFTER SELF ATK BUFF:", user.Attack);

      // Ataque básico imediato
      const enemy = targets.find((t) => t.id !== user.id);

      // console.log("ATTACK BEFORE DAMAGE:", user.Attack);

      const userName = formatChampionName(user);
      const selfLog = `${userName} executou Juramento de Ferro, perdendo ${this.selfDamage} HP e ${this.defLoss} de Defesa, mas ganhando +${this.atkBuff} de Ataque por ${this.buffDuration} turnos.`;

      if (!enemy) {
        return { log: selfLog };
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      results[0].log = selfLog + " " + results[0].log;

      return results;
    },
  },

  {
    key: "sentença_de_campo",
    name: "Sentença de Campo",
    bf: 90,
    damageMode: "standard",
    healPercent: 60,
    minHeal: 25,
    contact: true,

    priority: 0,
    description() {
      return `Ralia se cura em ${this.healPercent}% do dano efetivo causado (arredondado para o múltiplo de 5 mais próximo). Cura mínima: ${this.minHeal}.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
      const effectiveDamage = result.totalDamage || 0;
      const healingAmount = Math.max(
        this.minHeal,
        effectiveDamage * (this.healPercent / 100),
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
    bf: 55,
    damageMode: "piercing",
    atkDebuff: 20,
    debuffDuration: 2,
    contact: false,
    isUltimate: true,
    ultCost: 3,

    priority: 0,
    description() {
      return `Ralia finca sua lâmina no chão e impõe sua lei ao campo. Por ${this.debuffDuration} turnos, inimigos ativos sofrem −${this.atkDebuff} de Ataque. Em seguida, Ralia executa um ataque automático contra todos os inimigos vivos.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      // Pegar todos os inimigos (time diferente do usuário)
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      // Aplicar dano em cada inimigo
      for (const enemy of enemies) {
        const damageResult = new DamageEvent({
          baseDamage,
          mode: "hybrid",
          piercingPortion: baseDamage, // todo: talvez queira ser uma porção diferente do dano total
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        enemy.modifyStat({
          statName: "Attack",
          amount: -this.atkDebuff,
          duration: this.debuffDuration,
          context,
        }); // -20 Attack por 2 turnos

        results.push(damageResult);
      }

      return results;
    },
  },
];

export default raliaSkills;
