export function applyDamageModifiers(event, debugMode) {
  if (!event.attacker?.getDamageModifiers) {
    if (debugMode) {
      console.log(`⚠️ [MODIFIERS] Nenhum modificador de dano disponível`);
    }
    return;
  }

  if (debugMode) {
    console.group(`🔧 [DAMAGE MODIFIERS]`);
    console.log(`📍 Damage Inicial: ${event.damage}`);
  }

  event.attacker.purgeExpiredModifiers(event.context.currentTurn);

  const modifiers = event.attacker.getDamageModifiers();

  if (debugMode) {
    console.log(`🎯 Total de modificadores: ${modifiers.length}`);
  }

  for (let i = 0; i < modifiers.length; i++) {
    const mod = modifiers[i];

    if (debugMode) {
      console.log(
        `  └─ Modifier ${i + 1}: name='${mod.name || "Unknown"}' | damage=${event.damage}`,
      );
    }

    if (mod.apply) {
      const oldDamage = event.damage;

      const out = mod.apply({
        baseDamage: event.damage,
        user: event.attacker,
        target: event.target,
        skill: event.skill,
      });

      if (typeof out === "number") {
        event.damage = out;

        if (debugMode) {
          console.log(
            `     ✏️ Aplicado: ${oldDamage} → ${event.damage} (Δ ${event.damage - oldDamage})`,
          );
        }
      }
    }
  }

  if (debugMode) {
    console.log(`📊 Damage Final: ${event.damage}`);
    console.groupEnd();
  }
}
