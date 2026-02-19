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

  console.log("📡 EMIT:", eventName);
  console.log(
    "🎯 Champions recebidos:",
    champArray.map((c) => c.name),
  );

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
          self: champ,
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
