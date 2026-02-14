import { DamageEngine } from "../../core/damageEngine.js";
import { formatChampionName } from "../../core/formatters.js";

const reyskaroneSkills = [
  // =========================
  // Ataque Básico
  // =========================
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `Ataque padrão (BF 100).
    Contato: ✅`,
    contact: true,
    cooldown: 0,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 100;
      return DamageEngine.resolveDamage({
        baseDamage: (user.Attack * bf) / 100,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },

  // =========================
  // H1 — Corte Tributário
  // =========================
  {
    key: "tributo_de_sangue",
    name: "Tributo de Sangue",
    description: `
    Cooldown: 1 turno
    Contato: ❌
    Prioridade: +1
    BF 65.
    Reyskarone sacrifica 15% de seu HP máximo para aplicar "Tributo" por 2 turnos.
    Aliados que atacarem o alvo curam 15 HP e causam 10 de dano a mais. Além disso, ataca o alvo escolhido imediatamente após a execução da habilidade (BF 65).`,
    contact: false,
    cooldown: 2,
    priority: 1,
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;

      const hpSacrifice = Math.round((user.maxHP * 0.15) / 5) * 5;

      user.takeDamage(hpSacrifice);

      enemy.applyKeyword("tributo", 2, context);

      const bf = 65;
      const result = DamageEngine.resolveDamage({
        baseDamage: (user.Attack * bf) / 100,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });

      if (result?.log) {
        result.log += `\n${formatChampionName(enemy)} foi marcado com Tributo.`;
      }

      return result;
    },
  },

  // =========================
  // H2 — Transfusão Marcial
  // =========================
  {
    key: "transfusao_marcial",
    name: "Transfusão Marcial",
    description: `
    Cooldown: 2 turnos
    Prioridade: 2
    Concede a um aliado:
    +20 ATQ
    +15% LifeSteal
    Duração: 2 turnos`,
    contact: false,
    cooldown: 2,
    priority: 2,
    targetSpec: ["select:ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: 20,
        duration: 2,
        context,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: 15,
        duration: 2,
        context,
      });

      return {
        log:
          user === ally
            ? `${formatChampionName(user)} fortaleceu-se com Transfusão Marcial.`
            : `${formatChampionName(user)} fortaleceu ${formatChampionName(ally)} com Transfusão Marcial.`,
      };
    },
  },

  // =========================
  // ULT — Pacto Carmesim
  // =========================
  {
    key: "pacto_carmesim",
    name: "Pacto Carmesim",
    description: `
    Cooldown: 2 turnos
    Prioridade: +5
    Seleciona um aliado:
    Ele recebe:
    +60% ATQ
    +35% LifeSteal
    Duração: 2 turnos`,
    contact: false,
    cooldown: 2,
    priority: 5,
    targetSpec: ["select:ally"],
    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: ally.Attack * 0.6,
        duration: 2,
        context,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: 35,
        duration: 2,
        context,
      });

      ally.applyKeyword("pacto_carmesim", 3, context, {
        source: user.id,
      });

      return {
        log: `${formatChampionName(user)} selou um Pacto Carmesim com ${formatChampionName(ally)}.`,
      };
    },
  },
];

export default reyskaroneSkills;
