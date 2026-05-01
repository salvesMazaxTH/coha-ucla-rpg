import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const raliaSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  totalBlock,
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
        type: "physical",
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
        type: "physical",
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
    bf: 50,
    damageMode: "piercing",
    piercingPercentage: 75,

    atkDebuff: 20,
    debuffDuration: 2,
    bleedStacks: 2,
    bleedDuration: 2,

    contact: false,
    isUltimate: true,
    ultCost: 3,

    priority: 0,
    description() {
      return `Ralia finca sua lâmina no chão e impõe sua lei ao campo. Por ${this.debuffDuration} turnos, inimigos ativos sofrem −${this.atkDebuff} de Ataque. Em seguida, Ralia causa dano perfurante (${this.piercingPercentage}% de perfuração) contra todos os inimigos vivos. Também aplica ${this.bleedStacks} stacks de Sangramento (por ${this.bleedDuration} turnos).`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      // Os alvos já são os inimigos
      const enemies = targets;

      // Aplica o debuff de Ataque antes do dano
      for (const enemy of enemies) {
        enemy.modifyStat({
          statName: "Attack",
          amount: -this.atkDebuff,
          duration: this.debuffDuration,
          context,
        });
      }

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      // Aplicar dano e bleed em cada inimigo
      for (const enemy of enemies) {
        const rawResult = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPercentage: this.piercingPercentage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const resultsArray = Array.isArray(rawResult) ? rawResult : [rawResult];
        const mainDamage = resultsArray[0];

        results.push(...resultsArray);

        const hitLanded =
          mainDamage &&
          mainDamage.evaded !== true &&
          mainDamage.immune !== true &&
          (mainDamage.totalDamage ?? 0) > 0;

        if (hitLanded) {
          enemy.applyStatusEffect(
            "bleeding",
            this.bleedDuration,
            context,
            {},
            this.bleedStacks,
          );
        }
      }

      return results;
    },
  },
];

export default raliaSkills;
