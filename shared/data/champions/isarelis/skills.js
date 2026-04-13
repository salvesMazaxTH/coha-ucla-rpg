import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";

const isarelisSkills = [
  {
    key: "eviscerar",
    name: "Eviscerar",

    bf: 80,
    damageMode: "standard",
    contact: true,
    priority: 0,

    description() {
      return "Ataca o alvo. Se agir antes dele no turno, causa dano perfurante adicional (+20%).";
    },

    targetSpec: ["enemy"],

    // 👇 configurável
    damageBonusRatio: 0.2,

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      // ================================
      // 🔴 CHECAGEM DE ORDEM DE TURNO
      // ================================
      const execIdx = context.executionIndex;

      const turnMap = context.turnExecutionMap;
      const targetIdx = turnMap?.get(enemy?.id);

      const actedBeforeTarget =
        execIdx !== undefined &&
        (targetIdx === undefined || execIdx < targetIdx);

      // ================================
      // 🔴 CÁLCULO FINAL
      // ================================
      let finalBaseDamage = baseDamage;
      let mode = this.damageMode;
      let piercingPortion = 0;

      if (actedBeforeTarget) {
        finalBaseDamage = baseDamage * (1 + this.damageBonusRatio);

        // O DANO INTEIRO VIRA PERFURANTE
        mode = "hybrid";
        piercingPortion = finalBaseDamage;

        context.registerDialog({
          message: `${user.name} dilacera antes da reação! (+perfuração)`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      // ================================
      // 🔴 DAMAGE EVENT (HYBRID)
      // ================================
      return new DamageEvent({
        baseDamage: finalBaseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        mode,
        piercingPortion,
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
  },
];

export default isarelisSkills;
