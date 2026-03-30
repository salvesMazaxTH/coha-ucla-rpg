import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const naelysSkills = [
  basicStrike,

  {
    key: "pingente_das_ondas",
    name: "Pingente das Ondas",
    contact: false,
    bf: 80,
    damageMode: "standard",
    priority: 0,
    element: "water",
    selfHealAmount: 50,
    allyHealAmount: 20,

    description() {
      return `Naelys cura a si mesma em ${this.selfHealAmount} HP e um aliado em ${this.allyHealAmount} HP, causando dano ao inimigo.`;
    },

    targetSpec: ["enemy", { type: "select:ally", excludesSelf: true }],

    resolve({ user, targets, context = {} }) {
      // console.log("[NAELYS] Pingente das Ondas iniciou.");
      /* console.log(
        "[NAELYS] Targets:",
        targets?.map((t) => t?.name),
      );
      */
      const [enemy, ally] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      // console.log("[NAELYS] BaseDamage calculado:", baseDamage);

      const results = [];

      if (enemy) {
        // console.log("[NAELYS] Executando DamageEvent contra:", enemy.name);

        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();

        // console.log("[NAELYS] DamageEvent resultado:", damageResult);

        results.push(damageResult);
      }

      // console.log("[NAELYS] Cura própria:", this.selfHealAmount);
      const selfHealApplied = user.heal(this.selfHealAmount, context, user);
      // console.log("[NAELYS] Cura aplicada na Naelys:", selfHealApplied);

      if (ally) {
        // console.log("[NAELYS] Cura no aliado:", ally.name, this.allyHealAmount);

        const allyHealApplied = ally.heal(this.allyHealAmount, context, user);

        // console.log("[NAELYS] Cura aplicada no aliado:", allyHealApplied);
      } else {
        // console.log("[NAELYS] Nenhum aliado selecionado.");
      }

      results.push({
        type: "heal",
        userId: user.id,
        targetId: user.id,
        amount: this.selfHealAmount,
        log: `${formatChampionName(user)} recupera ${this.selfHealAmount} HP.`,
      });

      if (ally) {
        results.push({
          type: "heal",
          userId: user.id,
          targetId: ally.id,
          amount: this.allyHealAmount,
          log: `${formatChampionName(ally)} recupera ${this.allyHealAmount} HP.`,
        });
      }

      // console.log("[NAELYS] Pingente das Ondas finalizado.");

      return results;
    },
  },

  {
    key: "massa_do_mar_revolto",
    name: "Massa do Mar Revolto",
    contact: false,
    priority: 2,
    element: "water",
    damageReduction: 20,

    description() {
      return `Naelys assume uma postura marítima até o fim do próximo turno, recebendo ${this.damageReduction}% de redução de dano. Primeira vez que for atingida por turno, contra-ataca o agressor com Ataque Básico.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      // console.log("[NAELYS] Massa do Mar Revolto ativada.");
      // console.log("[NAELYS] Turno atual:", context.currentTurn);

      user.runtime.hookEffects ??= [];

      const effect = {
        key: "massa_do_mar_revolto",
        expiresAt: context.currentTurn + 2,
        lastTriggerTurn: null,

        onAfterDmgTaking({
          attacker,
          defender,
          damage,
          skill,
          owner,
          context,
        }) {
          // console.log("[NAELYS] Hook onAfterDmgTaking disparado.");
          // console.log("[NAELYS] Target:", defender?.name);
          // console.log("[NAELYS] Damage:", damage);
          // console.log("[NAELYS] Skill recebida:", skill?.key);

          if (defender !== owner) {
            // console.log("[NAELYS] Ignorado: defender !== owner");
            return;
          }

          if (damage <= 0) {
            // console.log("[NAELYS] Ignorado: dano <= 0");
            return;
          }

          if (this.lastTriggerTurn === context.currentTurn) {
            // console.log("[NAELYS] Já contra-atacou neste turno.");
            return;
          }

          this.lastTriggerTurn = context.currentTurn;

          // console.log("[NAELYS] Contra-ataque autorizado.");

          context.extraDamageQueue ??= [];

          const basic = owner.skills.find((s) => s.key === "ataque_basico");

          if (!basic) {
            // console.log("[NAELYS] ERRO: ataque básico não encontrado.");
            return;
          }

          const baseDamage = (owner.Attack * basic.bf) / 100;

          // console.log("[NAELYS] Contra-ataque baseDamage:", baseDamage);

          context.extraDamageQueue.push({
            mode: "standard",
            baseDamage,
            attacker: owner,
            defender: attacker,
            skill: {
              ...basic,
              key: "massa_do_mar_revolto_counter",
              name: "Contra-ataque Mar Revolto",
            },

            dialog: {
              message: `${formatChampionName(owner)} executou um contra-ataque da Massa do Mar Revolto em ${formatChampionName(source)}!`,
              duration: 1000,
            },
          });

          /* console.log(
            "[NAELYS] Contra-ataque enfileirado contra:",
            source?.name,
          );
          */

          return {
            log: `🌊 ${formatChampionName(owner)} contra-ataca com a força do mar!`,
          };
        },

        onTurnEnd({ self, context }) {
          const currentTurn = context.currentTurn;

          // console.log("[NAELYS] Hook onTurnEnd verificado.");
          /* console.log(
            "[NAELYS] currentTurn:",
            currentTurn,
            "expiresAt:",
            this.expiresAt,
          );
          */
          if (currentTurn >= this.expiresAt) {
            // console.log("[NAELYS] Massa do Mar Revolto expirou.");

            self.runtime.hookEffects = self.runtime.hookEffects.filter(
              (e) => e !== this,
            );
          }
        },
      };

      user.runtime.hookEffects.push(effect);

      // console.log("[NAELYS] HookEffect registrado.");

      user.applyDamageReduction({
        amount: this.damageReduction,
        type: "percent",
        duration: 1,
        context,
      });

      // console.log("[NAELYS] Redução de dano aplicada:", this.damageReduction);

      return {
        log: `${formatChampionName(user)} assume a Massa do Mar Revolto!`,
      };
    },
  },

  {
    key: "sobrefluxo",
    name: "Sobrefluxo",
    contact: false,
    damageMode: "standard",
    priority: 3,
    duration: 3,
    maxBonus: 120,
    stacksPerHPLost: 30,
    bonusPerStack: 15,
    element: "water",

    isUltimate: true,
    ultCost: 3,

    description() {
      return `Por ${this.duration} turnos, Naelys causa dano adicional baseado no HP perdido (até +${this.maxBonus}).`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      // console.log("[NAELYS] Sobrefluxo ativado.");
      // console.log("[NAELYS] Turno atual:", context.currentTurn);

      const { currentTurn } = context;

      user.addDamageModifier({
        id: "sobrefluxo",
        expiresAtTurn: currentTurn + this.duration,

        apply: ({ baseDamage, attacker }) => {
          const lostHP = attacker.maxHP - attacker.HP;

          const stacks = Math.floor(lostHP / this.stacksPerHPLost);

          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          // console.log("[NAELYS] Sobrefluxo cálculo:");
          // console.log("[NAELYS] lostHP:", lostHP);
          // console.log("[NAELYS] stacks:", stacks);
          // console.log("[NAELYS] bonus:", bonus);
          // console.log("[NAELYS] baseDamage:", baseDamage);
          // console.log("[NAELYS] totalDamage:", baseDamage + bonus);

          return baseDamage + bonus;
        },
      });

      // console.log("[NAELYS] DamageModifier Sobrefluxo registrado.");
      // console.log("[NAELYS] Expira no turno:", currentTurn + this.duration);

      return {
        log: `🌊 ${formatChampionName(user)} libera o Sobrefluxo!`,
      };
    },
  },
];

export default naelysSkills;
