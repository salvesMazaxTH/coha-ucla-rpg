import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const kaiSkills = [
  basicAttack,
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
      return new DamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
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
      return `Kai assume uma postura incandescente até o início do próximo turno, recebendo ${this.damageReduction}% de redução de dano. 
      Se sofrer ataque de contato, contra-ataca causando ${this.counterAtkDmg} de dano perfurante e aplica queimadura. 
      Se causar dano, ativa Brasa Viva por 2 turnos: todos seus ataques causam ${this.flamingFistsBonus} de dano adicional e aplicam queimadura prolongada independente da afinidade elemental do alvo.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];

      const counterAtkDmg = this.counterAtkDmg;
      const flamingFistsBonus = this.flamingFistsBonus;

      user.runtime.fireStance = "postura"; // Sinaliza para o sistema de VFX que a postura está ativa

      const effect = {
        key: "postura_da_brasa_viva",
        state: "postura", // "postura" → "brasa_viva"
        expiresAt: context.currentTurn + 2,

        // 🔥 CONTRA-ATAQUE
        onAfterDmgTaking({
          dmgSrc,
          dmgReceiver,
          skill,
          damage,
          owner,
          context,
        }) {
          if (dmgReceiver !== owner) return;
          if (!skill?.contact) return;
          if (damage <= 0) return;
          if (skill?.key === "postura_da_brasa_viva_counter") return;
          if (!dmgSrc?.alive) return;

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "hybrid",
            baseDamage: counterAtkDmg,
            piercingPortion: counterAtkDmg,
            user: owner,
            target: dmgSrc,
            skill: {
              key: "postura_da_brasa_viva_counter",
              name: "Contra-ataque Brasa Viva",
              contact: true,
            },
          });

          context.visual.dialogEvents.push({
            type: "dialog",
            message: `${formatChampionName(owner)} executou um contra-ataque da Brasa Viva em ${formatChampionName(dmgSrc)}!`,
            sourceId: owner.id,
            targetId: owner.id,
          });

          dmgSrc.applyKeyword("queimando", 2, context, {
            source: owner,
          });

          return {
            log: `${formatChampionName(dmgSrc)} é queimado ao atingir ${formatChampionName(owner)} em contato!`,
          };
        },

        // 🔥 BÔNUS ENQUANTO BRASA VIVA
        onBeforeDmgDealing({ dmgSrc, owner, damage, context }) {
          if (this.state !== "brasa_viva") return;
          if (dmgSrc !== owner) return;

          return {
            damage: damage + flamingFistsBonus,
            log: `🔥 Brasa Viva: +${flamingFistsBonus} Dano Direto!`,
          };
        },

        onAfterDmgDealing({ dmgSrc, dmgReceiver, owner, damage, context }) {
          if (dmgSrc !== owner) return;
          if (damage <= 0) return;

          // 🔥 TRANSIÇÃO
          if (
            this.state === "postura" &&
            owner.runtime.fireStance !== "brasa_viva"
          ) {
            this.state = "brasa_viva";
            owner.runtime.fireStance = "brasa_viva";
            this.expiresAt = context.currentTurn + 2;

            return {
              log: "🔥 Brasa Viva é ativada!",
            };
          }

          // 🔥 EFEITO ATIVO
          if (this.state === "brasa_viva") {
            if (!dmgReceiver?.applyKeyword) return;

            dmgReceiver.applyKeyword("queimando", 2, context, {
              source: owner,
            });

            return {
              log: `${formatChampionName(dmgReceiver)} está Queimando (Brasa Viva)!`,
            };
          }
        },

        // 🔥 REMOÇÃO AUTOMÁTICA
        onTurnStart({ self, context }) {
          if (context.currentTurn >= this.expiresAt) {
            self.runtime.hookEffects = self.runtime.hookEffects.filter(
              (e) => e !== this,
            );
            self.runtime.fireStance = null; // Sinaliza para o sistema de VFX que a postura foi removida
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
    targetSpec: ["all-enemies"],
    resolve({ user, targets, context = {} }) {
      // Busca todos os inimigos vivos do contexto (garante que não dependa de targets)
      const enemies = Array.from(
        (context &&
          context.allChampions &&
          context.allChampions.values &&
          context.allChampions.values()) ||
          [],
      ).filter((champion) => champion.team !== user.team && champion.alive);
      const results = [];
      if (!enemies.length) return results;

      // Distribui aleatoriamente os socos entre os inimigos
      for (let i = 0; i < this.hits; i++) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        const isBurning = target.hasKeyword("queimando");
        const directBonus = isBurning ? this.burningBonus : 0;
        const result = new DamageEvent({
          baseDamage: this.damagePerHit,
          user,
          target,
          skill: this,
          context,
          allChampions: context?.allChampions,
          directDamage: directBonus,
        }).execute();
        results.push({ ...result, targetId: target.id });
      }
      return results;
    },
  },
];

export default kaiSkills;
