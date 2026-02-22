import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
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
    manaCost: 80,
    priority: 1,
    description() {
      return `Custo: ${this.manaCost} MP
        Dano: BF ${this.bf}
        Contato: ${this.contact ? "✅" : "❌"}
        Efeitos:
        - Cura 50 HP de Naelys.
        - Cura 15 HP do aliado escolhido.`;
    },
    targetSpec: ["self", "ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const healAmount = 50;
      const allyHealAmount = 15;
      const damageResult = CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: ally,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
      // Aplica a cura em Naelys
      user.heal(healAmount);
      // Aplica a cura no aliado
      ally.heal(allyHealAmount);
      return (
        damageResult,
        {
          log: `${formatChampionName(user.name)} cura a si mesmo em ${healAmount} HP e ${formatChampionName(ally.name)} em ${allyHealAmount} HP.`,
        }
      );
    },
  },

  {
    key: "massa_do_mar_revolto",
    name: "Massa do Mar Revolto",
    contact: false,
    manaCost: 90,
    priority: 2,
    damageReduction: 20,
    counterDamage: 20,

    description() {
      return `Custo: ${this.manaCost} MP
Contato: ❌

Naelys assume uma postura marítima até o início do próximo turno:
- Recebe −${this.damageReduction}% de Dano Bruto Final.
- Primeira vez que for atingida por turno, contra-ataca o agressor com Ataque Básico.`;
    },

    targetSpec: ["self"],

    execute({ user, context }) {
      user.runtime.hookEffects ??= [];

      const counterDamage = this.counterDamage;

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
            mode: "raw",
            baseDamage,
            user: self,
            target: attacker,
            skill: {
              ...basic,
              key: "massa_do_mar_revolto_counter",
              name: "Contra-ataque Mar Revolto",
            },
          });

          return {
            log: `🌊 ${formatChampionName(self)} contra-ataca com a força do mar!`,
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

      user.runtime.hookEffects.push(effect);

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
    manaCost: 400,
    priority: 3,
    duration: 3,
    maxBonus: 120,

    description() {
      return `Custo: ${this.manaCost} MP

      Por ${this.duration} turnos:
      Naelys causa dano adicional baseado no HP perdido.
      Limite máximo: +${this.maxBonus} de Dano Bruto.`;
    },

    targetSpec: ["self"],

    execute({ user, context }) {
      const { currentTurn } = context;

      user.addDamageModifier({
        id: "sobrefluxo",
        expiresAtTurn: currentTurn + this.duration,

        apply: ({ baseDamage, user }) => {
          const lostHP = user.baseHP - user.HP;

          const bonus = Math.min(Math.floor(lostHP / 20) * 15, this.maxBonus);

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
