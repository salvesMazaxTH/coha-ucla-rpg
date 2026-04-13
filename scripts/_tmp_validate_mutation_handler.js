import { GameMatch } from "../shared/engine/match/GameMatch.js";
import { Champion } from "../shared/core/Champion.js";
import { championDB } from "../shared/data/championDB.js";
import { Action } from "../shared/engine/combat/Action.js";
import { TurnResolver } from "../shared/engine/combat/TurnResolver.js";

function makeHandler(match) {
  return (request) => {
    if (!request || typeof request !== "object") return null;

    if (request.mode === "swap") {
      const old = match.combat.getChampion(request.targetId);
      if (!old || !old.alive) return null;
      const baseData = championDB[request.newChampionKey];
      if (!baseData) return null;

      const swappedOut = match.combat.swapOut(request.targetId);
      if (!swappedOut) return null;

      const newChampion = Champion.fromBaseData(
        baseData,
        "tutu-test",
        old.team,
        { combatSlot: old.combatSlot },
      );
      newChampion.championKey = request.newChampionKey;
      newChampion.runtime.swappedFrom = request.targetId;
      match.combat.activeChampions.set(newChampion.id, newChampion);
      return { champion: newChampion };
    }

    if (request.mode === "restore") {
      const restored = match.combat.restoreInactive(request.targetId);
      if (!restored) return null;
      return { champion: restored };
    }

    if (request.mode === "transform") {
      const target = match.combat.activeChampions.get(request.targetId);
      if (!target || !target.alive) return null;
      const baseData = championDB[request.newChampionKey];
      if (!baseData) return null;

      const form = Champion.fromBaseData(baseData, target.id, target.team, {
        combatSlot: target.combatSlot,
      });
      form.championKey = request.newChampionKey;
      form.HP = target.HP;
      form.runtime = { ...form.runtime, ...target.runtime };
      match.combat.replaceActiveChampion(form);
      return { champion: form };
    }

    return null;
  };
}

function validateSwapImmediate() {
  const match = new GameMatch();
  const lana = Champion.fromBaseData(championDB.lana, "lana-test", 1, {
    combatSlot: 0,
  });
  lana.championKey = "lana";
  lana.HP = 130;

  const sengoku = Champion.fromBaseData(championDB.sengoku, "sengoku-test", 2, {
    combatSlot: 0,
  });
  sengoku.championKey = "sengoku";
  sengoku.Attack = 180;

  match.combat.registerChampion(lana, { trackSnapshot: false });
  match.combat.registerChampion(sengoku, { trackSnapshot: false });

  match.combat.enqueueAction(
    new Action({
      userId: sengoku.id,
      skillKey: "golpe_furioso",
      targetIds: { enemy: lana.id },
    }),
  );

  const resolver = new TurnResolver(match, {}, { mutationHandler: makeHandler(match) });
  const result = resolver.resolveTurn();
  const snapshot = result.actionResults[0]?.context?._intermediateSnapshot ?? [];

  return {
    hasTutuInSnapshot: snapshot.some((c) => c.championKey === "lana_dino"),
    hasLanaInSnapshot: snapshot.some((c) => c.id === "lana-test"),
  };
}

function validateTransformImmediate() {
  const match = new GameMatch();
  const sengoku = Champion.fromBaseData(championDB.sengoku, "sengoku-test", 1, {
    combatSlot: 0,
  });
  sengoku.championKey = "sengoku";

  const bruno = Champion.fromBaseData(championDB.bruno, "bruno-test", 2, {
    combatSlot: 0,
  });
  bruno.championKey = "bruno";

  match.combat.registerChampion(sengoku, { trackSnapshot: false });
  match.combat.registerChampion(bruno, { trackSnapshot: false });

  match.combat.enqueueAction(
    new Action({
      userId: sengoku.id,
      skillKey: "forma_primordial",
      targetIds: { self: sengoku.id },
    }),
  );

  const resolver = new TurnResolver(match, {}, { mutationHandler: makeHandler(match) });
  const result = resolver.resolveTurn();
  const snapshot = result.actionResults[0]?.context?._intermediateSnapshot ?? [];

  return {
    transformedInSnapshot: snapshot.some(
      (c) => c.id === sengoku.id && c.championKey === "sengoku_primordial",
    ),
  };
}

const oldLog = console.log;
console.log = () => {};

const swap = validateSwapImmediate();
const transform = validateTransformImmediate();

console.log = oldLog;
process.stdout.write(JSON.stringify({ swap, transform }, null, 2));
