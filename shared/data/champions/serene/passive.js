import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "Calmaria Protetora",
  healPercent: 15,
  description() {
    return `Sempre que Serene terminar um turno sem ter seu HP reduzido, ela cura ${this.healPercent}% do seu HP máximo no início do próximo turno.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  // Marca dano recebido no turno
  onAfterDmgTaking({ attacker, defender, owner, context }) {
    owner.runtime = owner.runtime || {};
    owner.runtime.sereneDamagedTurn = context.currentTurn;
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (!actionSource || actionSource.id !== owner.id) return;

    owner.runtime ??= {};
    const previousSkillKey = owner.runtime.lastSereneSkillKey ?? null;
    owner.runtime.lastSereneSkillKey = skill?.key ?? null;

    console.debug(
      `[Serene:passive:onActionResolved] user=${owner.name} skill=${skill?.key ?? "N/A"} prevSkill=${previousSkillKey} nextSkill=${owner.runtime.lastSereneSkillKey} turn=${context?.currentTurn ?? "N/A"}`,
    );
  },

  // Executa no início do turno
  onTurnStart({ owner, context }) {
    const lastDamaged = owner.runtime.sereneDamagedTurn;

    // Se NÃO tomou dano no turno anterior
    if (lastDamaged === context.currentTurn - 1) return;

    const heal = owner.maxHP * 0.15;
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    const before = owner.HP;
    owner.heal(heal, context);

    return {
      log: `[PASSIVA — Calmaria Protetora] ${formatChampionName(owner)} recuperou ${heal} HP (${before} → ${owner.HP}).`,
    };
  },
};
