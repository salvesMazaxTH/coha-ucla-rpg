export function applyDamage(event) {
  if (event.constructor.debugMode) console.group(`❤️ [APLICANDO DANO]`);
  if (event.constructor.debugMode) {
    console.log(`👤 Defender: ${event.defender.name}`);
    console.log(`📍 HP Antes: ${event.defender.HP}/${event.defender.maxHP}`);
    console.log(`💥 Dano: ${event.damage}`);
  }

  const hpBefore = event.defender.HP;

  const damageToApply = Math.floor(event.damage);

  console.log(`[DAMAGE COMPOSITION] damageToApply: ${damageToApply}`);
  console.log(`[DAMAGE COMPOSITION] hpBefore: ${hpBefore}`);

  event.defender.takeDamage(damageToApply, event.context);

  console.log(
    `➡️ [applyDamage] Dano aplicado, após takeDamage: ${damageToApply}, HP de ${event.defender.name}: ${event.defender.HP}/${event.defender.maxHP}`,
  );

  event.hpAfter = event.defender.HP;
  event.actualDmg = hpBefore - event.hpAfter;

  event.context.registerDamage({
    target: event.defender,
    amount: damageToApply,
    sourceId: event.attacker?.id,
    isCritical: event.crit?.didCrit,
    isDot: !!event.context.isDot,
    flags: {
      evaded: event.evasionAttempted ? false : undefined,
    },
  });

  if (event.constructor.debugMode) {
    console.log(`📍 HP Depois: ${event.hpAfter}/${event.defender.maxHP}`);
    console.log(`✅ Dano efetivo: ${event.actualDmg}`);
    if (event.hpAfter <= event.defender.maxHP * 0.2)
      console.log(`🚨 ALERTA: Defender em perigo! (<20% HP)`);
    if (event.hpAfter <= 0) console.log(`💀 Defender DERROTADO!`);
    console.groupEnd();
  }
}
