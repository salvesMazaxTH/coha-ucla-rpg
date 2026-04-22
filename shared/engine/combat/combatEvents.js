const debugMode = false; // Set to true to enable detailed logging of combat events

export function emitCombatEvent(eventName, payload, champions, options = {}) {
  const results = [];

  /*   const ignoredEventsForDebug = new Set([
    "onActionResolved",
    "onTurnEnd",
    "onTurnStart",
  ]);
 */

  if (/* !ignoredEventsForDebug.has(eventName) */ debugMode) {
    // console.log(`[EVENT EMIT] 🔥 Champions in emitCombatEvent:`, champions);
  }

  if (debugMode) {
    console.group(`📡 EVENT: ${eventName}`);
    /*  console.log(`[EVENT EMIT] ${eventName}`, {
      source: payload?.source?.name,
      target: payload?.target?.name,
    }); */
  }

  if (!champions) {
    if (debugMode) {
      // console.log(`[EVENT EMIT] ⚠️ No champions provided`);
    }
    return results;
  }

  const champArray = Array.isArray(champions)
    ? champions
    : Array.from(champions.values());

  if (debugMode /* && !ignoredEventsForDebug.has(eventName) */) {
    /* console.log(
      `[EVENT EMIT] 🎯 Champions recebidos:`,
      champArray,
      champArray.map((c) => c.name).join(", "),
    ); */
  }

  for (const champ of champArray) {
    const hookSources = [];

    // 🔹 Passiva real
    if (champ.passive) {
      hookSources.push(champ.passive);
    }

    // 🔹 StatusEffects (Map)
    if (champ.statusEffects && champ.statusEffects.size > 0) {
      for (const effectInstance of champ.statusEffects.values()) {
        hookSources.push(effectInstance);
      }
    }

    // 🔹 Hook effects temporários
    if (champ.runtime?.hookEffects?.length) {
      hookSources.push(...champ.runtime.hookEffects);
    }

    for (const source of hookSources) {
      const hook = source[eventName];
      if (typeof hook !== "function") continue;

      if (debugMode) {
        // console.log(`➡️ Triggering ${champ.name} (${source.key || "passive"})`);
      }

      const scope = source.hookScope?.[eventName];
      const canRun = options?.canRun;

      if (scope && payload[scope] !== champ) continue;
      if (typeof canRun === "function" && !canRun(eventName, champ, source)) {
        continue;
      }

      try {
        // console.log(`[HOOK CALL] ${champ.name} → ${source.key}.${eventName}`);
        const res = hook.call(source, {
          ...payload,
          owner: champ,
          emitter: emitCombatEvent,
        });

        if (res) {
          results.push(res);
        }
      } catch (err) {
        console.error(
          `[HOOK ERROR] ${champ.name} → ${source.key || "passive"}.${eventName}`,
          err,
        );
      }
    }
  }

  if (debugMode) {
    // console.log(`[EVENT EMIT] 📦 Aggregated results:`, results);
    console.groupEnd();
  }

  return results;
}
