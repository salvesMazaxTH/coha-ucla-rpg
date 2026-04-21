// step9 - resultBuilder.js - Consolida o resultado final do ataque, incluindo logs, dano total, HP final, etc. Pode ser um objeto ou um array (em caso de contra-ataques/reflects).
import { formatChampionName } from "../../../ui/formatters.js";

export function buildFinalResult(event) {
  // Consolida todos os logs (os da pipeline + os que hooks podem ter jogado no context)
  const allLogs = [
    ...event.beforeLogs,
    ...event.afterLogs,
    // ...(event.context.extraLogs || []),
  ];

  let finalLog;
  if (event.context?.isDot) {
    const targetName = formatChampionName(event.defender);
    const effectName =
      event.skill && typeof event.skill === "object"
        ? event.skill.name
        : event.skill;
    const dmg = Math.floor(event.damage);
    finalLog = `${targetName} sofreu ${dmg} de dano${
      effectName ? ` de <b>${effectName}</b>` : ""
    }`;
    finalLog += `\nHP final de ${targetName}: ${event.hpAfter}/${event.defender.maxHP}`;
  } else {
    finalLog = _buildLog(
      event.attacker,
      event.defender,
      event.skill,
      event.damage,
      event.crit,
      event.hpAfter,
    );
  }

  if (allLogs.length) {
    finalLog += "\n" + allLogs.join("\n");
  }

  if (event.constructor.debugMode) console.groupEnd(); // Fecha o grupo principal do CombatResolver

  const mainResult = {
    totalDamage: event.actualDmg,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    log: finalLog,
    crit: event.crit,
    damageDepth: event.context.damageDepth,
    skill: event.skill,
    // Incluímos a jornada do dano para debug/painéis se necessário
    journey: {
      base: event.baseDamage,
      mitigated: event.damage,
      actual: event.actualDmg,
    },
  };

  // Se houver contra-ataques/reflects, retorna um array, senão o objeto único
  return event.extraResults.length > 0
    ? [mainResult, ...event.extraResults]
    : mainResult;
}

function _buildLog(user, target, skill, dmg, crit, hpAfter) {
  const userName = user ? formatChampionName(user) : "Efeito";
  const targetName = formatChampionName(target);

  // skill pode ser objeto ou string
  const skillName = skill && typeof skill === "object" ? skill.name : skill;
  dmg = Math.floor(dmg);
  let log = `${userName} usou <b>${skillName}</b> e causou ${dmg} de dano a ${targetName}`;

  if (crit.didCrit) log += ` (CRÍTICO)`;

  log += `\nHP final de ${targetName}: ${hpAfter}/${target.maxHP}`;

  return log;
}
