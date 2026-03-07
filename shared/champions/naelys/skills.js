import { CombatResolver } from "../../engine/combat/combatResolver.js";
import { formatChampionName } from "../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const naelysSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "pingente_das_ondas",
    name: "Pingente das Ondas",
    contact: false,
    bf: 80,
    damageMode: "standard",
    priority: 1,
    element: "water",
    selfHealAmount: 50,
    allyHealAmount: 20,
    description() {
      return `Naelys cura a si mesma em ${this.selfHealAmount} HP e um aliado em ${this.allyHealAmount} HP, causando dano ao inimigo (BF ${this.bf}).`;
    },
    targetSpec: ["enemy", "self", { type: "select:ally", excludesSelf: true }],
    resolve({ user, targets, context = {} }) {
      const [ ally, enemy ] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      // DANO
      if (enemy) {
        const damageResult = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });

        results.push(damageResult);
      }

      // CURA (cria evento no formato esperado)
      user.heal(this.selfHealAmount);
      ally.heal(this.allyHealAmount);

      results.push({
        type: "heal",
        userId: user.id,
        targetId: user.id,
        amount: this.selfHealAmount,
        log: `${formatChampionName(user)} recupera ${this.selfHealAmount} HP.`,
      });

      results.push({
        type: "heal",
        userId: user.id,
        targetId: ally.id,
        amount: this.allyHealAmount,
        log: `${formatChampionName(ally)} recupera ${this.allyHealAmount} HP.`,
      });

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
      user.runtime.hookEffects ??= [];

      const effect = {
        key: "massa_do_mar_revolto",
        expiresAt: context.currentTurn + 2,
        lastTriggerTurn: null,

        onAfterDmgTaking({ attacker, target, damage, skill, self, context }) {
          if (target !== self) return;
          if (damage <= 0) return;

          if (this.lastTriggerTurn === context.currentTurn) return;

          // evita loop
          if (skill?.key === "massa_do_mar_revolto_counter") return;

          this.lastTriggerTurn = context.currentTurn;

          context.extraDamageQueue ??= [];

          const basic = self.skills.find((s) => s.key === "ataque_basico");
          if (!basic) return;

          const baseDamage = (self.Attack * basic.bf) / 100;

          context.extraDamageQueue.push({
            mode: "standard",
            baseDamage,
            user: self,
            target: attacker,
            skill: {
              ...basic,
              key: "massa_do_mar_revolto_counter",
              name: "Contra-ataque Mar Revolto",
            },
          });

          context.visual.dialogEvents.push({
            type: "dialog",
            message: `${formatChampionName(self)} executou um contra-ataque da Massa do Mar Revolto em ${formatChampionName(attacker)}!`,
            sourceId: self.id,
            targetId: attacker.id,
          });

          return {
            log: `🌊 ${formatChampionName(self)} contra-ataca com a força do mar!`,
          };
        },

        onTurnEnd({ self, currentTurn }) {
          if (currentTurn >= this.expiresAt) {
            self.runtime.hookEffects = self.runtime.hookEffects.filter(
              (e) => e !== this,
            );
          }
        },
      };

      user.runtime?.hookEffects.push(effect);

      // usa seu método real de redução
      user.applyDamageReduction({
        amount: this.damageReduction,
        duration: 1,
        context,
      });

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
      const { currentTurn } = context;

      user.addDamageModifier({
        id: "sobrefluxo",
        expiresAtTurn: currentTurn + this.duration,

        apply: ({ baseDamage, user }) => {
          const lostHP = user.maxHP - user.HP;

          const bonus = Math.min(
            Math.floor(lostHP / this.stacksPerHPLost) * this.bonusPerStack,
            this.maxBonus,
          );

          return baseDamage + bonus;
        },
      });

      return {
        log: `🌊 ${formatChampionName(user)} libera o Sobrefluxo!`,
      };
    },
  },
];

export default naelysSkills;
