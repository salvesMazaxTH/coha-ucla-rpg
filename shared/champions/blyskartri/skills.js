import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const blyskartriSkills = [
  basicAttack,
  {
    key: "fluxo_restaurador",
    name: "Fluxo Restaurador",
    manaGiven: 100,
    manaCost: 50,
    contact: false,
    description() {
      return `Concede ${this.manaGiven} de mana a si ou a um aliado selecionado.`;
    },
    targetSpec: ["select:ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;
      ally.addResource({
        amount: this.manaGiven,
        resourceType: "mana",
        source: user,
        context,
      });
      return {
        log: `${formatChampionName(user)} restaurou mana de ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "blyskartri_hab_2",
    name: "Blyskartri-Hab-2",
    bf: 60,
    speedBuff: 10,
    evasionBuff: 2,
    buffsDuration: 2,
    manaGiven: 50,
    manaCost: 600,
    contact: false,
    description() {
      return `Concede ${this.speedBuff} e aumenta a Esquiva em ${this.evasionBuff}x (ou concede +5 caso não possua Esquiva) por ${this.buffsDuration} turnos e concede +${this.manaGiven} MP.`;
    },
    targetSpec: ["select:ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      ally.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffsDuration,
        context,
      });

      if (baseEvasion > 0) {
        // 3x usando percentual da base
        ally.modifyStat({
          statName: "Evasion",
          amount: (this.evasionBuff - 1) * 100,
          duration: this.buffsDuration,
          context,
          isPercent: true,
        });
      } else {
        // conceder pequeno bônus flat inicial
        ally.modifyStat({
          statName: "Evasion",
          amount: 10,
          duration: this.buffsDuration,
          context,
        });
      }

      ally.addResource({
        amount: this.manaGiven,
        resourceType: "mana",
        source: user,
        context,
      });

      return {
        log: `${formatChampionName(user)} concedeu buffs e mana para ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "florescer_abissal",
    name: "Florescer Abissal",
    manaBuff: 2,
    manaCost: 600,
    dmgBonusPerStack: 2.5,
    effectDuration: 3,
    contact: false,

    description(champion) {
      const stacks = champion.runtime?.passiveStacks ?? 0;
      const percent = stacks * this.dmgBonusPerStack;

      return `Duplica o MP do alvo e concede +${percent}% de dano por ${this.effectDuration} turnos (escala com os acúmulos de Blyskartri).`;
    },

    targetSpec: ["select:ally"],

    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      // 🔹 1️⃣ Duplica o MP atual
      const amount = ally.mana * (this.manaBuff - 1);

      ally.addResource({
        amount,
        resourceType: "mana",
        source: user,
        context,
      });

      // 🔹 2️⃣ Remove versão antiga do buff (evita stacking duplicado)
      ally.damageModifiers = ally.damageModifiers.filter(
        (m) => m.id !== "florescer_abissal_bonus",
      );

      // 🔹 3️⃣ Aplica modificador percentual baseado nos stacks atuais
      ally.addDamageModifier({
        id: "florescer_abissal_bonus",
        name: "Florescer Abissal",
        expiresAtTurn: (context.currentTurn ?? 0) + this.effectDuration,

        apply: ({ baseDamage, user: damageUser }) => {
          const stacks = damageUser.runtime?.passiveStacks ?? 0;
          const percentBonus = stacks * this.dmgBonusPerStack;

          return baseDamage * (1 + percentBonus / 100);
        },
      });

      context.dialogEvents ??= [];
      context.dialogEvents.push({
        type: "dialog",
        message: `${formatChampionName(user)} faz ${formatChampionName(ally)} florescer em poder vital.`,
        sourceId: user.id,
        targetId: ally.id,
        blocking: true,
      });

      return {
        log: `${formatChampionName(user)} duplicou o MP de ${formatChampionName(ally)} e concedeu bônus de dano por ${this.effectDuration} turnos.`,
      };
    },
  },
];

export default blyskartriSkills;
