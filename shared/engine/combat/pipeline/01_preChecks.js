import { formatChampionName } from "../../../ui/formatters.js";
import { emitCombatEvent } from "../combatEvents.js";

export function preChecks(event) {
  /*     console.log("DEBUG ATTACKER:", event.attacker);
  console.log("DEBUG DEFENDER:", event.defender); */
  // 1️⃣ IMUNIDADE
  const results = emitCombatEvent(
    "onDamageIncoming",
    {
      source: event.attacker,
      target: event.defender,
      damage: event.damage,
      context: event.context,
    },
    event.allChampions,
  );

  for (const r of results) {
    if (r?.message) {
      event.context?.logs?.push?.(r.message);
    }

    if (r?.cancel) {
      console.log(
        `[DAMAGE CANCEL] ${event.defender.name} teve o dano cancelado por status-effect`,
      );
      return _buildImmuneResult(event);
    }
  }

  // 2️⃣ ESQUIVA
  if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    !event.skill?.cannotBeEvaded
  ) {
    const evasion = _rollEvasion({
      attacker: event.attacker,
      defender: event.defender,
      context: event.context,
      debugMode: event.constructor.debugMode,
    });

    if (evasion?.evaded) {
      event.context.registerDamage({
        target: event.defender,
        amount: 0,
        sourceId: event.attacker?.id,
        flags: { evaded: true },
      });

      emitCombatEvent(
        "onEvade",
        {
          source: event.attacker,
          target: event.defender,
          damage: event.damage,
          context: event.context,
        },
        event.allChampions,
      );

      return {
        totalDamage: 0,
        evaded: true,
        targetId: event.defender.id,
        userId: event.attacker.id,
      };
    }
  }

  // 3️⃣ SHIELD BLOCK
  /* if (
    event.mode !== event.constructor.Modes.ABSOLUTE &&
    !event.skill?.cannotBeBlocked
  ) {
    if (event.defender._checkAndConsumeShieldBlock?.(event.context)) {
      event.context.registerDamage({
        target: event.defender,
        amount: 0,
        sourceId: event.attacker?.id,
        flags: { shieldBlocked: true },
      });

      return _buildShieldBlockResult(event);
    }
  } */
  return null;
}

function _rollEvasion({ attacker, defender, context, debugMode }) {
  const editMode = context?.editMode ?? {};
  const chance = Number(defender.Evasion) || 0;

  if (debugMode) {
    console.log("🔥 _rollEvasion chamado:", {
      attacker: attacker.name,
      defender: defender.name,
      evasion: chance,
      editMode,
    });
  }

  // 1️⃣ Override absoluto (debug)
  if (editMode.alwaysEvade) {
    return {
      attempted: true,
      evaded: true,
      log: `\n${formatChampionName(defender)} evadiu automaticamente.`,
    };
  }

  // 2️⃣ Sem chance real
  if (chance <= 0 && !editMode.alwaysEvade) {
    return null; // NÃO houve tentativa
  }

  // 3️⃣ Roll
  const roll = Math.random() * 100;
  const evaded = roll < chance;

  if (debugMode) {
    console.log(`🎯 Roll de Esquiva: ${roll.toFixed(2)}`);
    console.log(`🎲 Chance de Esquiva: ${chance}%`);
    console.log(evaded ? "✅ Ataque EVADIDO!" : "❌ Ataque ACERTADO");
  }

  // 4️⃣ Resultado padronizado
  return {
    evaded,
    attempted: true,
    log: `\n${formatChampionName(defender)} tentou esquivar o ataque... !`,
  };
}

function _buildImmuneResult(event) {
  // Usamos as propriedades que já existem na instância
  const targetName = formatChampionName(event.defender);
  const username = event.attacker ? formatChampionName(event.attacker) : null;
  const skillName = event.skill?.name || "habilidade";

  event.context.registerDamage({
    target: event.defender,
    amount: 0,
    sourceId: event.attacker?.id ?? null,
    flags: { immune: true },
  });

  const log = username
    ? `${username} tentou usar ${skillName} em ${targetName}, mas o alvo possui Imunidade Absoluta!`
    : `${targetName} é imune ao dano!`;

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker?.id ?? null,
    evaded: false,
    immune: true,
    log,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
}

/* function _buildShieldBlockResult(event) {
  const targetName = formatChampionName(event.defender);
  const username = formatChampionName(event.attacker);
  const skillName = event.skill?.name || "habilidade";

  return {
    baseDamage: event.baseDamage,
    totalDamage: 0,
    finalHP: event.defender.HP,
    targetId: event.defender.id,
    userId: event.attacker.id,
    shieldBlocked: true,
    evaded: false,
    log: `${username} usou ${skillName} em ${targetName}, mas o escudo de ${targetName} bloqueou completamente e se dissipou!`,
    crit: { chance: 0, didCrit: false, bonus: 0, roll: null },
  };
} */
