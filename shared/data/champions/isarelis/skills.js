import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";

const isarelisSkills = [
  {
    key: "eviscerar",
    name: "Eviscerar",

    bf: 55,
    damageMode: "standard",
    contact: true,
    priority: 0,

    description() {
      return "Causa dano físico de contato ao alvo.";
    },

    targetSpec: ["enemy"],

    // 👇 configurável
    damageBonusRatio: 0.2,
    piercingRatio: 0.6,

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      // ================================
      // Agora a passiva cuida do bônus de dano/perfuração via hook
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context.allChampions,
      }).execute();
    },
  },

  {
    key: "passo_furtivo",
    name: "Passo Furtivo",
    description() {
      return "Torna-se Invisível até sua próxima ação. Não pode ser alvo de inimigos.";
    },

    targetSpec: ["self"],
    priority: 1,

    resolve({ user, context }) {
      // reset invis anterior
      user.removeStatusEffect("invisible");

      user.applyStatusEffect("invisible", 99, context, {
        source: "passo_furtivo",
      });

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "passo_furtivo_cleanup",
      );

      const appliedContext = context;

      user.runtime.hookEffects.push({
        key: "passo_furtivo_cleanup",
        group: "skillRuntime",
        ownerId: user.id,

        hookScope: {
          onActionResolved: "source",
        },

        onActionResolved({ owner, actionSource, context }) {
          if (!actionSource || actionSource.id !== owner.id) return;

          // ignorar a PRÓPRIA ação
          if (context === appliedContext) return;

          // qualquer outra ação remove
          owner.removeStatusEffect("invisible");

          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (e) => e.key !== "passo_furtivo_cleanup",
          );

          context?.registerDialog?.({
            message: `${formatChampionName(owner)} emerge das sombras.`,
            sourceId: owner.id,
          });
        },
      });

      context.registerDialog({
        message: `${formatChampionName(user)} desaparece nas sombras.`,
        sourceId: user.id,
      });

      return [
        {
          log: `${formatChampionName(user)} desaparece nas sombras e torna-se <b>Invisível</b> até sua próxima ação.`,
        },
      ];
    },
  },

  {
    key: "golpe_de_misericordia",
    name: "Golpe de Misericórdia",

    bf: 85,
    damageMode: "standard",
    contact: true,
    isUltimate: true,
    ultCost: 3,
    priority: 0,

    executeThreshold: 0.25, // ≤ 25% do HP máximo
    executeFlatThreshold: 85, // ≤ 85 HP
    stealthBonus: 0.5,
    finishingType: "regular",

    description() {
      const percent = this.executeThreshold * 100;
      return `Desfere um golpe letal. Executa o alvo apenas se estiver extremamente ferido (≤ ${percent}% do HP máximo e ≤ ${this.executeFlatThreshold} HP). Causa ${this.stealthBonus * 100}% a mais de dano enquanto Invisível.`;
    },

    finishingRule({ defender }) {
      const maxHP = defender?.maxHP;
      const currentHP = defender?.HP;

      if (!Number.isFinite(maxHP) || maxHP <= 0) {
        return this.executeThreshold;
      }

      if (!Number.isFinite(currentHP)) return;

      // condição flat primeiro (mais restritiva em HP alto)
      if (currentHP > this.executeFlatThreshold) return;

      return this.executeThreshold;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;
      if (!enemy) return;

      let baseDamage = (user.Attack * this.bf) / 100;

      if (user.hasStatusEffect("invisible")) {
        baseDamage *= 1 + this.stealthBonus;

        context.registerDialog({
          message: `${formatChampionName(user)} ataca das sombras!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context.allChampions,
      }).execute();
    },
  },
];

export default isarelisSkills;
