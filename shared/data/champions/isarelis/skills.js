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
      user.removeStatusEffect("invisivel");

      user.applyStatusEffect("invisivel", 99, context, {
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
          owner.removeStatusEffect("invisivel");

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
    priority: 0,

    executeThreshold: 0.2, // 20%
    // 0.9, // 90% PARA TESTES
    stealthBonus: 0.5, // +50% dano se invisível
    damageBonusRatio: 0.2,
    piercingRatio: 0.6,
    finishingType: "isarelis_finishing",

    description() {
      return `Desfere um golpe letal. Se o alvo estiver abaixo de ${this.executeThreshold * 100}% de Vida, é executado. Causa mais dano se usado enquanto Invisível.`;
    },

    finishingRule() {
      return this.executeThreshold;
    },

    finishingDialog({ attacker, defender }) {
      return `${attacker.name} executa ${defender.name}!`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      let baseDamage = (user.Attack * this.bf) / 100;

      // ================================
      // 🔴 CHECAGEM DE ORDEM DE TURNO
      // ================================
      const execIdx = context.executionIndex;

      const turnMap = context.turnExecutionMap;
      const targetIdx = turnMap?.get(enemy?.id);

      const actedBeforeTarget =
        execIdx !== undefined &&
        (targetIdx === undefined || execIdx < targetIdx);

      // ============================
      // 🔥 BONUS DE STEALTH
      // ============================
      const isInvisible = user.hasStatusEffect("invisivel");

      if (isInvisible) {
        baseDamage *= 1 + this.stealthBonus;

        context.registerDialog({
          message: `${user.name} ataca das sombras!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

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
];

export default isarelisSkills;
