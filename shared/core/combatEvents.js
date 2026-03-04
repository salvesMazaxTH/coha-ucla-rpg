const debugMode = true; // Set to true to enable detailed logging of combat events

export function emitCombatEvent(eventName, payload, champions) {
  const results = [];

  const ignoredEventsForDebug = new Set(['onActionResolved', 'onTurnEnd', 'onTurnStart']);


  if (!ignoredEventsForDebug.has(eventName)) {
    console.log(`🔥 Champions in emitCombatEvent:`, champions);
  }

  if (debugMode) {
    console.group(`📡 EVENT: ${eventName}`);
  }

  if (!champions) {
    if (debugMode) console.log("⚠️ No champions provided");
    return results;
  }

  const champArray = Array.isArray(champions)
    ? champions
    : Array.from(champions.values());

  if (debugMode && !ignoredEventsForDebug.has(eventName)) {
    console.log(
      "🎯 Champions recebidos:",
     champArray,
     champArray.map((c) => c.name).join(", "
      )
    );
  }

  for (const champ of champArray) {
    const hookSources = [];

    // 🔹 Passiva real
    if (champ.passive) {
      hookSources.push(champ.passive);
    }

    // 🔹 Hook effects temporários
    if (champ.runtime?.hookEffects?.length) {
      hookSources.push(...champ.runtime.hookEffects);
    }

    for (const source of hookSources) {
      const hook = source[eventName];
      if (typeof hook !== "function") continue;

      if (debugMode) {
        console.log(`➡️ Triggering ${champ.name} (${source.key || "passive"})`);
      }

      try {
        const res = hook.call(source, {
          ...payload,
          self: champ, // alias enquanto refatora e migra tudo para consistência com os outros hooks
          owner: champ,
        });

        if (res) {
          if (debugMode) console.log(`⬅️ Result:`, res);
          results.push(res);
        }
      } catch (err) {
        console.error(
          `[HOOK ERROR] ${champ.name} (${source.key || "passive"})`,
          err,
        );
      }
    }
  }

  if (debugMode) {
    console.log("📦 Aggregated results:", results);
    console.groupEnd();
  }

  return results;
}
