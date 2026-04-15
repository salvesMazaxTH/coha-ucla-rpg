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
    key: "segundo_sutra_mantra_do_ferro_vivo",
    name: "Segundo sutra: Mantra do Ferro Vivo",
    shieldPercent: 45,
    contact: false,
    priority: 3,

    description() {
      return `Durante este turno, após receber dano:
      Ganha um escudo equivalente a ${this.shieldPercent}% do dano sofrido.`;
    },

    targetSpec: ["self"],

    resolve({ user, targets, context = {} }) {
      const shieldPercent = this.shieldPercent;

      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects.push({
        key: "mantra_do_ferro_vivo_shield",
        name: "Mantra do Ferro Vivo (Proteção)",
        onAfterDmgTaking({ defender, damage, context }) {
          const shieldAmount = Math.floor(damage * (shieldPercent / 100));
          defender.addShield(shieldAmount, 0, context);

          return {
            log: `<b>[${this.name}]</b> ${formatChampionName(defender)} ganhou um escudo de ${shieldAmount} (${shieldPercent}% do dano sofrido)!`,
          };
        },
      });
    },
  },

  {
    key: "terceiro_sutra_bencao_do_deus_da_montanha",
    name: "Terceiro Sutra: Bênção do Deus da Montanha",

    contact: false,
    priority: 2,

    duration: 1,
    dmgReduct: 20,

    description() {
      return `Durante este turno, Morakhan e todos os aliados ficam imunes a controle e recebem ${this.dmgReduct}% de redução de dano.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);

      for (const ally of allies) {
        // 🛡️ Redução de dano via sistema nativo
        ally.applyDamageReduction({
          amount: this.dmgReduct,
          duration: this.duration,
          source: this.name,
          type: "percent",
          context,
        });

        // 🚫 Imunidade a CC (hook ainda necessário)
        ally.runtime ??= {};
        ally.runtime.hookEffects ??= [];

        // evita duplicação
        ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
          (e) => e.key !== "bencao_deus_montanha_cc",
        );

        ally.runtime.hookEffects.push({
          key: "bencao_deus_montanha_cc",
          expiresAtTurn: context.currentTurn + this.duration,

          hookScope: {
            onStatusEffectIncoming: "target",
          },

          onStatusEffectIncoming({ target, statusEffect }) {
            if (!statusEffect?.subtypes) return;

            if (
              statusEffect.subtypes.includes("hardCC") ||
              statusEffect.subtypes.includes("softCC")
            ) {
              return {
                cancel: true,
                message: `${formatChampionName(target)} está sob a Bênção do Deus da Montanha e é imune a controle!`,
              };
            }
          },
        });
      }

      context.registerDialog({
        message: `${formatChampionName(user)} invoca a Bênção do Deus da Montanha, protegendo seus aliados!`,
        sourceId: user.id,
      });

      return [
        {
          log: `<b>${formatChampionName(user)}</b> concede <b>${this.name}</b> a todos os aliados!`,
        },
      ];
    },
  },

  {
    key: "quarto_sutra_postura_da_montanha",
    name: "Quarto sutra: Postura da Montanha",
    contact: false,

    isUltimate: true,
    ultCost: 2,

    description() {
      return `Desencadeia a Postura da Montanha, durante este turno:
      Fica imune a controle.
      Reflete 50% de todo dano sofrido por habilidades.
      Recebe 60% de redução de dano a mais.`;
    },

    targetSpec: ["self"],

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
