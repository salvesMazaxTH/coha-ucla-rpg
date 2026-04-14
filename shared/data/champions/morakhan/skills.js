import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const morakhanSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicStrike,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "morakhan_1st_skill",
    name: "Morakhan 1st skill",
    contact: false,
    bf: 80,
    damageMode: "standard",
    priority: 0,

    description() {
      return `morakhan 1st skill description`;
    },

    targetSpec: [""],

    resolve({ user, targets, context = {} }) {
      // morakhan 1st skill
    },
  },

  {
    key: "morakhan_2nd_skill",
    name: "Morakhan 2nd skill",
    contact: false,
    priority: 0,

    description() {
      return `morakhan 2nd skill description`;
    },

    targetSpec: [""],

    resolve({ user, context }) {
      // morakhan 2nd skill
    },
  },

  {
    key: "quarto_sutra_postura_da_montanha",
    name: "Quarto sutra: Postura da Montanha",
    contact: false,
    damageMode: "standard",

    isUltimate: true,
    ultCost: 2,

    description() {
      return `Desencadeia a Postura da Montanha, durante este turno:
      Fica imune a controle.
      Reflete 50% de todo dano sofrido por habilidades.
      Recebe 60% de redução de dano a mais.`;
    },

    targetSpec: [""],

    resolve({ user, context }) {
      const effect = {
        hookScope: {
          onBeforeDmgTaking: "defender",
          onStatusEffectIncoming: "target",
        },
        onBeforeDmgTaking({ defender, attacker, damage, skill, context }) {
          const reflectedDamage = damage * 0.5;
          context.registerDialog?.({
            message: `<b>[ULTIMATE — ${this.name}]</b> ${formatChampionName(defender)} reflete ${Math.floor(reflectedDamage)} de dano para o atacante!`,
            sourceId: defender.id,
            targetId: defender.id,
          });

          context.extraDamageQueue.push({
            mode: DamageEvent.Modes.ABSOLUTE,
            baseDamage: reflectedDamage,
            attacker: defender,
            defender: attacker,
            skill: {
              key: "quarto_sutra_postura_da_montanha_counter",
              name: "Contra-ataque Postura da Montanha",
              contact: true,
            },

            dialog: {
              message: `${formatChampionName(defender)} reflete o dano com ${this.name}!`,
              duration: 1000,
            },
          });
          return {
            damage: damage * 0.4, // Recebe 60% a menos (100% - 60% = 40%)
            log: `[ULTIMATE — ${this.name}] ${formatChampionName(defender)} reflete ${Math.floor(reflectedDamage)} de dano para o atacante e recebe apenas 40% do dano!`,
          };
        },
        onStatusEffectIncoming({ target, statusEffect }) {
          if (!statusEffect?.subtypes) return;
          if (
            statusEffect.subtypes.includes("hardCC") ||
            statusEffect.subtypes.includes("softCC")
          ) {
            return {
              cancel: true,
              message: `${formatChampionName(target)} é imune a efeitos de Controle!`,
            };
          }
        },
      };

      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects.push(effect);
    },
  },
];

export default morakhanSkills;
