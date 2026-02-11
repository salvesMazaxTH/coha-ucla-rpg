import { DamageEngine } from "../core/damageEngine.js";
import { formatChampionName } from "../core/formatters.js";

const reyskaroneSkills = [
  // =========================
  // Ataque Básico
  // =========================
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `Ataque padrão (100% ATQ).`,
    cooldown: 0,
    priority: 0,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      return DamageEngine.resolveDamage({
        baseDamage: user.Attack,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
    },
  },

  // =========================
  // H1 — Corte Tributário
  // =========================
  {
    key: "corte_tributario",
    name: "Corte Tributário",
    description: `
    Cooldown: 1 turno
    Dano: 70% ATQ
    Aplica "Tributo" por 2 turnos.
    Aliados que atacarem o alvo curam 5 HP. Além disso, ataca o alvo escolhido imediatamente após a execução da habilidade (Dano = 70% ATQ).`,
    cooldown: 2,
    priority: 1,
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;

      enemy.applyKeyword("tributo", 2, context);

      return DamageEngine.resolveDamage({
        baseDamage: Math.round(user.Attack * 0.7),
        user,
        target: enemy,
        skill: this.name,
        context,
      });
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
    Concede a um aliado:
    +20 ATQ
    +15% LifeSteal
    Duração: 2 turnos`,
    cooldown: 2,
    priority: 0,
    targetSpec: ["select:ally"],
    execute({ user, targets, context }) {
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
        log: `${formatChampionName(user)} fortaleceu ${formatChampionName(ally)} com Transfusão Marcial.`,
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
    Cooldown: 3 turnos
    Seleciona um aliado:
    Ele recebe:
    +35 ATQ
    +30% LifeSteal
    Duração: 3 turnos`,
    cooldown: 3,
    priority: 2,
    targetSpec: ["select:ally"],
    execute({ user, targets, context }) {
      const { ally } = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: 35,
        duration: 3,
        context,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: 25,
        duration: 3,
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
