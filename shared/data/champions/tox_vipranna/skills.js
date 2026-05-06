import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const toxViprannaSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicStrike,
  // ========================
  // H1 — Língua Viperina
  // ========================
  {
    key: "lingua_viperina",
    name: "Língua Viperina",

    bf: 30,
    contact: true,
    damageMode: "standard",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Causa dano leve ao alvo.\n\nAplica Envenenado:\n\n• 4 stacks se o alvo não estiver envenenado\n• 2 stacks se já estiver`;
    },

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

      const alreadyPoisoned = enemy.hasStatusEffect("poisoned");
      const stacks = alreadyPoisoned ? 2 : 4;

      enemy.applyStatusEffect("poisoned", undefined, context, {}, stacks);

      return result;
    },
  },

  // ========================
  // H2 — Revestimento Tóxico
  // ========================
  {
    key: "revestimento_toxico",
    name: "Revestimento Tóxico",

    contact: false,
    priority: 3,

    auraDuration: 2,
    poisonedStacks: 2,
    defenseBuff: 35,

    targetSpec: ["self"],

    description() {
      return `Por ${this.auraDuration} turno(s):\n\n• Tox Vipranna recebe +${this.defenseBuff} de Defesa\n• Inimigos que realizarem ações de contato contra Tox Vipranna recebem ${this.poisonedStacks} stacks de Envenenado`;
    },

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.auraDuration,
        context,
        statModifierSrc: user,
      });

      const activatedTurn = context.currentTurn;

      user.runtime.hookEffects ??= [];

      // --- inimigos que atacarem por contato recebem Poisoned ---
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "revestimento_toxico_retaliation",
      );

      user.runtime.hookEffects.push({
        key: "revestimento_toxico_retaliation",
        expiresAtTurn: activatedTurn + this.auraDuration,
        poisonedStacks: this.poisonedStacks,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        onBeforeDmgTaking({ owner, attacker, skill, context }) {
          if (!skill?.contact) return;
          if (!attacker) return;

          attacker.applyStatusEffect(
            "poisoned",
            undefined,
            context,
            {},
            this.poisonedStacks,
          );

          return {
            log: `<b>[${this.name}]</b> ${formatChampionName(attacker)} recebeu ${this.poisonedStacks} stacks de <b>Envenenado</b> ao atacar ${formatChampionName(owner)}!`,
          };
        },
      });

      context.registerDialog?.({
        message: `${formatChampionName(user)} ativa <b>Revestimento Tóxico</b>!`,
        sourceId: user.id,
      });

      return {
        log: `${formatChampionName(user)} ativa <b>Revestimento Tóxico</b>!`,
      };
    },
  },

  // ========================
  // ULT — Colapso Ofídico
  // ========================
  {
    key: "colapso_ofidico",
    name: "Colapso Ofídico",

    contact: false,
    isUltimate: true,
    ultCost: 3,
    damageRatioPerStack: 0.125,
    priority: 1,

    targetSpec: ["enemy"],

    description() {
      return `Dobra os stacks de Envenenado do alvo e os consome.\n\nCausa dano absoluto equivalente a:\n\n<b>stacks consumidos × ${this.damageRatioPerStack * 100}% da vida perdida do alvo</b>`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      if (!enemy?.hasStatusEffect("poisoned")) {
        const failMessage = "Mas falhou.";

        context.registerDialog?.({
          message: failMessage,
          sourceId: user.id,
          targetId: enemy?.id ?? user.id,
        });

        return {
          log: failMessage,
        };
      }

      const poisonInstance = enemy.getStatusEffect("poisoned");
      const stacks = Number(poisonInstance.stacks) || 0;

      if (poisonInstance) {
        const doubledStacks = Math.max(1, stacks * 2);
        poisonInstance.stacks = doubledStacks;
        poisonInstance.stackCount = doubledStacks;
        poisonInstance.metadata = {
          ...(poisonInstance.metadata || {}),
          stacks: doubledStacks,
          stackCount: doubledStacks,
        };
        enemy.removeStatusEffect("poisoned");
      }

      const lostHP = Math.max(0, enemy.maxHP - enemy.HP);
      const baseDamage =
        Math.max(1, Number(poisonInstance.stacks) || 1) *
        this.damageRatioPerStack *
        lostHP;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
        mode: DamageEvent.Modes.ABSOLUTE,
      }).execute();

      return result;
    },
  },
];

export default toxViprannaSkills;
