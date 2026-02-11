const debugMode = true;

export function emitCombatEvent(eventName, payload, champions) {
  const results = [];

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

  for (const champ of champArray) {
    const hook = champ.passive?.[eventName];

    if (!hook) continue;

    if (debugMode) {
      console.log(`➡️ Triggering ${champ.name}`);
    }

    try {
      const res = hook({
        ...payload,
        self: champ,
      });

      if (res) {
        if (debugMode) console.log(`⬅️ Result:`, res);
        results.push(res);
      }
    } catch (err) {
      console.error(`[PASSIVE ERROR] ${champ.name}`, err);
    }
  }

  if (debugMode) {
    console.log("📦 Aggregated results:", results);
    console.groupEnd();
  }

  return results;
}
