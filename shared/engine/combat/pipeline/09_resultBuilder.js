import { formatChampionName } from "../../../ui/formatters.js";

export function buildFinalResult(event) {
  // Consolida todos os logs (os da pipeline + os que hooks podem ter jogado no context)
  const allLogs = [
    ...event.beforeLogs,
    ...event.afterLogs,
    // ...(event.context.extraLogs || []),
  ];

  let finalLog = _buildLog(
    event.attacker,
    event.defender,
    event.skill,
    event.actualDmg,
    event.crit,
    event.hpAfter,
  );

  if (allLogs.length) {
    finalLog += "\n" + allLogs.join("\n");
  }

  if (event.constructor.debugMode) console.groupEnd(); // Fecha o grupo principal do CombatResolver

  const mainResult = {
    totalDamage: event.actualDmg,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker.id,
    log: finalLog,
    crit: event.crit,
    damageDepth: event.context.damageDepth,
    skill: event.skill,
    // Incluímos a jornada do dano para debug/painéis se necessário
    journey: {
      base: event.originalBaseDamage,
      mitigated: event.finalDamage,
      actual: event.actualDmg,
    },
  };

  // Se houver contra-ataques/reflects, retorna um array, senão o objeto único
  return event.extraResults.length > 0
    ? [mainResult, ...event.extraResults]
    : mainResult;
}

function _buildLog(user, target, skill, dmg, crit, hpAfter) {
  const userName = formatChampionName(user);
  const targetName = formatChampionName(target);

  // skill pode ser objeto ou string
  const skillName = skill && typeof skill === "object" ? skill.name : skill;
  let log = `${userName} usou ${skillName} e causou ${dmg} de dano a ${targetName}`;

  if (crit.didCrit)
    log += ` (CRÍTICO ${(1 + crit.critBonusFactor).toFixed(2)}x)`;

  log += `\nHP final de ${targetName}: ${hpAfter}/${target.maxHP}`;

  return log;
}
