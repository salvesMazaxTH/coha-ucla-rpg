export function applyDamage(event) {
  if (event.constructor.debugMode) console.group(`❤️ [APLICANDO DANO]`);
  if (event.constructor.debugMode) {
    console.log(`👤 Target: ${event.target.name}`);
    console.log(`📍 HP Antes: ${event.target.HP}/${event.target.maxHP}`);
    console.log(`💥 Dano: ${event.damage}`);
  }

  const hpBefore = event.target.HP;

  const damageToApply = event.damage;

  console.log(`[DAMAGE COMPOSITION] damageToApply: ${damageToApply}`);
  console.log(`[DAMAGE COMPOSITION] hpBefore: ${hpBefore}`);

  event.target.takeDamage(damageToApply, event.context);

  console.log(
    `➡️ [applyDamage] Dano aplicado, após takeDamage: ${damageToApply}, HP de ${event.target.name}: ${event.target.HP}/${event.target.maxHP}`,
  );

  event.hpAfter = event.target.HP;
  event.actualDmg = hpBefore - event.hpAfter;

  event.context.registerDamage({
    target: event.target,
    amount: damageToApply,
    sourceId: event.attacker?.id,
    isCritical: event.crit?.didCrit,
    flags: {
      evaded: event.context.evasionAttempt ? false : undefined,
    },
  });

  if (event.constructor.debugMode) {
    console.log(`📍 HP Depois: ${event.hpAfter}/${event.target.maxHP}`);
    console.log(`✅ Dano efetivo: ${event.actualDmg}`);
    if (event.hpAfter <= event.target.maxHP * 0.2)
      console.log(`🚨 ALERTA: Target em perigo! (<20% HP)`);
    if (event.hpAfter <= 0) console.log(`💀 Target DERROTADO!`);
    console.groupEnd();
  }
}
