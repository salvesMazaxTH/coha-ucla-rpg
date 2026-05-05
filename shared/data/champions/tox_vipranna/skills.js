import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import poisoned from "../../statusEffects/poisoned.js";
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
    targetSpec: ["self"],

    description() {
      return `Por ${this.auraDuration} turno(s):\n\n• Inimigos que realizarem ações de contato contra Tox Vipranna recebem ${this.poisonedStacks} stacks de Envenenado\n\nNo turno seguinte:\n\n• O próximo dano de Envenenado sofrido por todos os personagens é dobrado`;
    },

    resolve({ user, context = {} }) {
      const activatedTurn = context.currentTurn;
      const userId = user.id;

      user.runtime.hookEffects ??= [];

      // --- Efeito 1: inimigos que atacarem por contato recebem Poisoned ---
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "revestimento_toxico_retaliation",
      );

      user.runtime.hookEffects.push({
        key: "revestimento_toxico_retaliation",
        expiresAtTurn: activatedTurn + this.auraDuration,

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

      // --- Efeito 2: próximo tick de Poisoned em todos os personagens é dobrado (próx. turno) ---
      const aliveChampions = context.aliveChampions ?? [];

      for (const champ of aliveChampions) {
        champ.runtime.hookEffects ??= [];

        const hookKey = `revestimento_toxico_doubled_${userId}_${champ.id}`;

        champ.runtime.hookEffects = champ.runtime.hookEffects.filter(
          (e) => e.key !== hookKey,
        );

        champ.runtime.hookEffects.push({
          key: hookKey,
          expiresAtTurn: activatedTurn + 3,
          _consumed: false,
          _activatedTurn: activatedTurn,

          onBeforeDmgTaking({ damage, context, skill }) {
            if (context.currentTurn <= this._activatedTurn) return;
            if (!context.isDot || skill?.key !== "poisoned_tick") return;
            if (this._consumed) return;

            this._consumed = true;

            return { damage: damage * 2 };
          },
        });
      }

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
    damageRatioPerStack: 0.2,
    priority: 1,

    targetSpec: ["enemy"],

    description() {
      return `Consome todos os stacks de Envenenado do alvo.\n\nCausa dano absoluto equivalente a:\n\n<b>stacks consumidos × ${this.damageRatioPerStack * 100}% da vida perdida do alvo</b>`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const poisonInstance = enemy.getStatusEffect("poisoned");
      const stacks = poisonInstance
        ? Math.max(1, Number(poisonInstance.stacks) || 1)
        : 0;

      if (poisonInstance) {
        enemy.removeStatusEffect("poisoned");
      }

      const lostHP = Math.max(0, enemy.maxHP - enemy.HP);
      const baseDamage = stacks * this.damageRatioPerStack * lostHP;

      if (baseDamage <= 0) {
        return {
          log: `${formatChampionName(user)} usa <b>${this.name}</b>, mas o alvo não possui veneno ou HP suficiente para causar dano significativo!`,
        };
      }

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
