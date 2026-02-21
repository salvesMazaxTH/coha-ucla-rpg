import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const kaiSkills = [
  basicAttack,
  {
    key: "gancho_rapido",
    name: "Gancho Rápido",
    bf: 60,
    contact: true,
    manaCost: 120,
    priority: 1,
    description() {
      return `Custo: ${this.manaCost} MP
        Contato: ${this.contact ? "✅" : "❌"}
        BF ${this.bf}.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
    },
  },

  {
    key: "postura_da_brasa_viva",
    name: "Postura da Brasa Viva",
    contact: false,
    manaCost: 100,
    damageReduction: 25,
    counterAtkDmg: 15,
    flamingFistsBonus: 15,
    priority: 2,
    description() {
      return `Custo: ${this.manaCost} MP
        Contato: ${this.contact ? "✅" : "❌"}
        Kai assume uma postura incandescente até o início do próximo turno, recebendo −${this.damageReduction} de Dano Bruto Final (mín. 10).
        Se sofrer um ataque de Contato, o atacante recebe ${this.counterAtkDmg} de Dano Direto e fica Queimando.

        Se Kai causar dano durante esse período, ativa Brasa Viva por 2 turnos:
        Punhos em Combustão causa +${this.flamingFistsBonus} de Dano Direto adicional (total +35), todos os alvos atingidos ficam "Queimando". independentemente de Afinidade, e o Queimando aplicado por Kai dura +1 turno.`;
    },
    targetSpec: ["self"],
    execute({ user, context }) {
      user.runtime.hookEffects ??= [];

      const counterAtkDmg = this.counterAtkDmg;
      const flamingFistsBonus = this.flamingFistsBonus;

      const effect = {
        key: "postura_da_brasa_viva",
        expiresAt: context.currentTurn + 2,

        // 🔥 CONTRA-ATAQUE VIA QUEUE
        afterDamageTaken({ attacker, target, skill, damage, self, context }) {
          if (target !== self) return;
          if (!skill?.contact) return;
          if (damage <= 0) return;

          // evita loop
          if (skill?.key === "postura_da_brasa_viva_counter") return;
          if (context.brasaVivaCounterTriggered) return;

          context.brasaVivaCounterTriggered = true;

          // cria fila se não existir
          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "direct",
            baseDamage: counterAtkDmg,
            directDamage: counterAtkDmg,
            user: self,
            target: attacker,
            skill: {
              key: "postura_da_brasa_viva_counter",
              name: "Contra-ataque Brasa Viva",
              contact: true,
            },
          });

          attacker.applyKeyword("queimando", 2, context, { source: self });

          return {
            log: `${formatChampionName(attacker)} é queimado ao atingir Kai em contato!`,
          };
        },

        // 🔥 ATIVA BRASA VIVA
        afterDamageDealt({ attacker, damage, self, context }) {
          if (attacker !== self) return;
          if (damage <= 0) return;

          self.runtime.hookEffects ??= [];

          // evita empilhamento
          if (self.runtime.hookEffects.some((e) => e.key === "brasa_viva"))
            return;

          const brasaVivaEffect = {
            key: "brasa_viva",
            expiresAt: context.currentTurn + 2,

            beforeDamageDealt({ attacker, self }) {
              if (attacker !== self) return;

              return {
                directDamage: flamingFistsBonus,
                log: `🔥 Brasa Viva: +${flamingFistsBonus} Dano Direto!`,
              };
            },

            afterDamageDealt({ attacker, target, self, context }) {
              if (attacker !== self) return;
              if (!target?.applyKeyword) return;

              target.applyKeyword("queimando", 2, context, { source: self });

              return {
                log: `${formatChampionName(target)} está Queimando (Brasa Viva)!`,
              };
            },

            onTurnStart({ self, context }) {
              if (context.currentTurn >= this.expiresAt) {
                self.runtime.hookEffects = self.runtime.hookEffects.filter(
                  (e) => e !== this,
                );
              }
            },
          };

          self.runtime.hookEffects.push(brasaVivaEffect);

          return {
            log: `🔥 Brasa Viva é ativada!`,
          };
        },

        onTurnStart({ self, context }) {
          if (context.currentTurn >= this.expiresAt) {
            self.runtime.hookEffects = self.runtime.hookEffects.filter(
              (e) => e !== this,
            );
          }
        },
      };

      user.runtime.posturaDaBrasaViva = effect;
      user.runtime.hookEffects.push(effect);

      user.applyDamageReduction({
        amount: this.damageReduction,
        duration: 1,
        context,
      });

      return {
        log: `${formatChampionName(user)} assume a Postura da Brasa Viva!`,
        crit: { didCrit: false, bonus: 0 },
      };
    },
  },

  {
    key: "barragem_de_socos_incandescentes",
    name: "Barragem de Socos Incandescentes",
    bf: 0,
    damagePerHit: 35,
    hits: 7,
    contact: true,
    manaCost: 380,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
        Contato: ${this.contact ? "✅" : "❌"}
        Kai desfere uma série de ${this.hits} socos flamejantes distribuídos aleatoriamente entre todos os inimigos, cada um causando ${this.damagePerHit} de dano. Essa habilidade também ativa "Punhos em Combustão" Regra Especial — Chamas Persistentes
        Se um alvo já estiver Queimando:
        → Esse soco causa +10 de Dano Direto adicional.`;
    },
    targetSpec: ["all-enemies"],
    execute({ user, targets, context = {} }) {
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
        const directBonus = isBurning ? 10 : 0;
        const result = CombatResolver.resolveDamage({
          baseDamage: this.damagePerHit,
          user,
          target,
          skill: this,
          context,
          allChampions: context?.allChampions,
          directDamage: directBonus,
        });
        results.push({ ...result, targetId: target.id });
      }
      return results;
    },
  },
];

export default kaiSkills;
