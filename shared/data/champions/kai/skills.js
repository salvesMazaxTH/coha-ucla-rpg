import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const kaiSkills = [
  basicStrike,
  {
    key: "gancho_rapido",
    name: "Gancho Rápido",
    bf: 60,
    contact: true,
    damageMode: "standard",
    priority: 1,
    description() {
      return `Ataque rápido de contato. Causa dano físico ao inimigo.`;
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
      // Ensure targetId is set for animation targeting
      return { ...result, targetId: enemy.id };
    },
  },

  {
    key: "postura_da_brasa_viva",
    name: "Postura da Brasa Viva",
    contact: false,
    damageReduction: 25,
    counterAtkDmg: 15,
    flamingFistsBonus: 35,
    priority: 2,
    element: "fire",

    description() {
      return `Durante este turno e o próximo, Kai assume uma postura incandescente, recebendo ${this.damageReduction}% de redução de dano. 
      Se sofrer ataque de contato, contra-ataca com ${this.counterAtkDmg} de dano perfurante e aplica Queimadura. 
      Ao causar dano, ativa Brasa Viva por 2 turnos: seus ataques causam +${this.flamingFistsBonus} de dano e sempre aplicam Queimadura.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];

      const counterAtkDmg = this.counterAtkDmg;

      user.runtime.fireStance = "postura"; // Sinaliza para o sistema de VFX que a postura está ativa

      const effect = {
        key: "postura_da_brasa_viva",
        state: "postura", // "postura" → "brasa_viva"
        expiresAtTurn: context.currentTurn + 2,

        // 🔥 CONTRA-ATAQUE
        onAfterDmgTaking({
          attacker,
          defender,
          skill,
          damage,
          owner,
          context,
        }) {
          if (defender !== owner) return;
          if (!skill?.contact) return;
          if (damage <= 0) return;
          if (skill?.key === "postura_da_brasa_viva_counter") return;
          if (!attacker?.alive) return;

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "piercing",
            baseDamage: counterAtkDmg,
            piercingPercentage: 100,
            attacker: owner,
            defender: attacker,
            type: "physical",
            skill: {
              key: "postura_da_brasa_viva_counter",
              name: "Contra-ataque Brasa Viva",
              contact: true,
            },

            dialog: {
              message: `${formatChampionName(owner)} contra-ataca com a Postura da Brasa Viva!`,
              duration: 1000,
            },
          });

          attacker.applyStatusEffect("burning", 2, context, {
            source: owner,
          });

          return {
            log: `${formatChampionName(attacker)} é queimado ao atingir ${formatChampionName(owner)} em contato!`,
          };
        },

        onAfterDmgDealing({ attacker, defender, owner, damage, context }) {
          if (attacker !== owner) return;
          if (damage <= 0) return;

          // 🔥 TRANSIÇÃO
          if (
            this.state === "postura" &&
            owner.runtime.fireStance !== "brasa_viva"
          ) {
            this.state = "brasa_viva";
            owner.runtime.fireStance = "brasa_viva";
            this.expiresAtTurn = context.currentTurn + 2;

            return {
              log: "🔥 Brasa Viva é ativada!",
            };
          }

          // 🔥 EFEITO ATIVO
          if (this.state === "brasa_viva") {
            if (!defender?.applyStatusEffect) return;

            defender.applyStatusEffect("burning", 2, context, {
              source: owner,
            });

            return {
              log: `${formatChampionName(defender)} está Queimando (Brasa Viva)!`,
            };
          }
        },

        // 🔥 REMOÇÃO AUTOMÁTICA
        onTurnStart({ owner, context }) {
          if (context.currentTurn >= this.expiresAtTurn) {
            owner.runtime.fireStance = null; // Sinaliza para o sistema de VFX que a postura foi removida
          }
        },
      };

      user.runtime.hookEffects.push(effect);

      // Redução de dano da postura
      user.applyDamageReduction({
        amount: this.damageReduction,
        duration: 1,
        context,
      });

      return {
        log: `${formatChampionName(user)} assume a Postura da Brasa Viva!`,
      };
    },
  },
  {
    key: "barragem_de_socos_incandescentes",
    name: "Barragem de Socos Incandescentes",
    bf: 0,
    damagePerHit: 40,
    damageMode: "standard",
    hits: 6,
    burningBonus: 10,
    contact: true,

    priority: 0,
    element: "fire",
    isUltimate: true,
    ultCost: 2,
    description() {
      return `Kai desfere uma série de socos flamejantes distribuídos aleatoriamente entre todos os inimigos, cada um causando ${this.damagePerHit} de dano. Alvos já queimando recebem dano adicional de ${this.burningBonus}.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      // Busca todos os inimigos vivos do contexto (garante que não dependa de targets)
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const results = [];
      if (!enemies.length) return results;

      for (let i = 0; i < this.hits; i++) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];

        // console.log("[KAI] HIT", i, target.name, target.alive);

        const directBonus = target.hasStatusEffect("burning")
          ? this.burningBonus
          : 0;

        const result = new DamageEvent({
          baseDamage: this.damagePerHit + directBonus,
          mode: "standard",
          attacker: user,
          defender: target,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push({ ...result, targetId: target.id });
      }

      return results;
    },
  },
];

export default kaiSkills;
