import { Champion } from "../../core/Champion.js";
import { championDB } from "../../data/championDB.js";

const STAT_FIELDS = [
  ["Attack", "baseAttack"],
  ["Defense", "baseDefense"],
  ["Speed", "baseSpeed"],
  ["Evasion", "baseEvasion"],
  ["Critical", "baseCritical"],
  ["LifeSteal", "baseLifeSteal"],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function roundStat(value) {
  return Math.round(asNumber(value, 0));
}

function cloneMapEntries(mapLike) {
  return mapLike instanceof Map ? new Map(mapLike) : new Map();
}

function cloneArrayEntries(arrayLike) {
  return Array.isArray(arrayLike) ? [...arrayLike] : [];
}

function mergeHookEffects(incoming = [], existing = []) {
  const merged = [];
  const seen = new Set();

  const pushUnique = (effects) => {
    for (const effect of effects) {
      if (!effect || effect.key === "champion_transformation_revert") continue;

      const dedupeKey = `${effect.group ?? ""}:${effect.key ?? ""}`;
      if (effect.key && seen.has(dedupeKey)) continue;

      if (effect.key) {
        seen.add(dedupeKey);
      }

      merged.push(effect);
    }
  };

  pushUnique(incoming);
  pushUnique(existing);

  return merged;
}

function transferDerivedStats({ sourceChampion, nextChampion, statMode }) {
  for (const [currentKey, baseKey] of STAT_FIELDS) {
    const oldBaseValue = asNumber(
      sourceChampion?.[baseKey],
      asNumber(sourceChampion?.[currentKey], 0),
    );
    const oldCurrentValue = asNumber(
      sourceChampion?.[currentKey],
      oldBaseValue,
    );
    const nextBaseValue = asNumber(
      nextChampion?.[baseKey],
      asNumber(nextChampion?.[currentKey], oldBaseValue),
    );

    let nextCurrentValue = nextBaseValue;

    if (statMode === "preserveFlat") {
      nextCurrentValue = oldCurrentValue;
    } else if (statMode === "baseOnly") {
      nextCurrentValue = nextBaseValue;
    } else {
      nextCurrentValue = nextBaseValue + (oldCurrentValue - oldBaseValue);
    }

    nextChampion[baseKey] = roundStat(nextBaseValue);
    nextChampion[currentKey] = roundStat(nextCurrentValue);
  }
}

function transferHP({ sourceChampion, nextChampion, hpMode }) {
  const oldHP = asNumber(sourceChampion?.HP, 0);
  const oldMaxHP = Math.max(
    1,
    asNumber(sourceChampion?.maxHP, asNumber(sourceChampion?.baseHP, 1)),
  );
  const nextMaxHP = Math.max(
    1,
    roundStat(
      asNumber(nextChampion?.baseHP, asNumber(nextChampion?.maxHP, oldMaxHP)),
    ),
  );

  let nextHP = nextMaxHP;
  if (hpMode === "preserveFlat") {
    nextHP = oldHP;
  } else if (hpMode === "fullHeal") {
    nextHP = nextMaxHP;
  } else {
    const ratio = clamp(oldHP / oldMaxHP, 0, 1);
    nextHP = Math.round(nextMaxHP * ratio);
  }

  nextChampion.baseHP = nextMaxHP;
  nextChampion.maxHP = nextMaxHP;
  nextChampion.HP = clamp(roundStat(nextHP), 0, nextMaxHP);
}

function transferCombatState({ sourceChampion, nextChampion }) {
  nextChampion.statusEffects = cloneMapEntries(sourceChampion?.statusEffects);
  nextChampion.damageModifiers = cloneArrayEntries(
    sourceChampion?.damageModifiers,
  );
  nextChampion.statModifiers = cloneArrayEntries(sourceChampion?.statModifiers);
  nextChampion.tauntEffects = cloneArrayEntries(sourceChampion?.tauntEffects);
  nextChampion.damageReductionModifiers = cloneArrayEntries(
    sourceChampion?.damageReductionModifiers,
  );
  nextChampion.alive = sourceChampion?.alive !== false;
  nextChampion.hasActedThisTurn = !!sourceChampion?.hasActedThisTurn;
  nextChampion.ultMeter = clamp(
    roundStat(asNumber(sourceChampion?.ultMeter, 0)),
    0,
    Math.max(1, roundStat(asNumber(nextChampion?.ultCap, 24))),
  );
}

export function applyChampionTransformation({
  combat,
  targetId,
  newChampionKey,
  currentTurn,
  duration = 0,
  hpMode = "preserveRatio",
  statMode = "deltaFromBase",
} = {}) {
  const sourceChampion = combat?.activeChampions?.get(targetId);
  const baseData = championDB?.[newChampionKey];

  if (!sourceChampion || !sourceChampion.alive || !baseData) return null;

  const transformedChampion = Champion.fromBaseData(
    baseData,
    sourceChampion.id,
    sourceChampion.team,
    { combatSlot: sourceChampion.combatSlot },
  );

  const previousTransformation = sourceChampion.runtime?.transformation ?? null;
  const originalChampionKey =
    previousTransformation?.originalChampionKey ?? sourceChampion.championKey;
  const sequence = asNumber(previousTransformation?.sequence, 0) + 1;
  const revertAtTurn = duration > 0 ? currentTurn + duration : null;
  const token = `${targetId}:${sequence}:${newChampionKey}`;
  const defaultHookEffects = cloneArrayEntries(
    transformedChampion.runtime?.hookEffects,
  );

  transferDerivedStats({
    sourceChampion,
    nextChampion: transformedChampion,
    statMode,
  });
  transferHP({ sourceChampion, nextChampion: transformedChampion, hpMode });
  transferCombatState({ sourceChampion, nextChampion: transformedChampion });

  transformedChampion.championKey = newChampionKey;
  transformedChampion.runtime = {
    ...transformedChampion.runtime,
    ...sourceChampion.runtime,
    transformation: {
      originalChampionKey,
      activeFormKey: newChampionKey,
      revertAtTurn,
      hpMode,
      statMode,
      sequence,
      token,
    },
  };

  transformedChampion.runtime.hookEffects = mergeHookEffects(
    defaultHookEffects,
    sourceChampion.runtime?.hookEffects,
  );

  combat.replaceActiveChampion(transformedChampion);

  return transformedChampion;
}

export function revertChampionTransformation({
  combat,
  targetId,
  expectedToken = null,
} = {}) {
  const sourceChampion = combat?.activeChampions?.get(targetId);
  const transformation = sourceChampion?.runtime?.transformation;
  if (!sourceChampion || !transformation?.originalChampionKey) return null;

  if (expectedToken && transformation.token !== expectedToken) {
    return null;
  }

  const originalBaseData = championDB?.[transformation.originalChampionKey];
  if (!originalBaseData) return null;

  const revertedChampion = Champion.fromBaseData(
    originalBaseData,
    sourceChampion.id,
    sourceChampion.team,
    { combatSlot: sourceChampion.combatSlot },
  );
  const defaultHookEffects = cloneArrayEntries(
    revertedChampion.runtime?.hookEffects,
  );

  transferDerivedStats({
    sourceChampion,
    nextChampion: revertedChampion,
    statMode: transformation.statMode ?? "deltaFromBase",
  });
  transferHP({
    sourceChampion,
    nextChampion: revertedChampion,
    hpMode: transformation.hpMode ?? "preserveRatio",
  });
  transferCombatState({ sourceChampion, nextChampion: revertedChampion });

  revertedChampion.championKey = transformation.originalChampionKey;
  revertedChampion.runtime = {
    ...revertedChampion.runtime,
    ...sourceChampion.runtime,
  };

  delete revertedChampion.runtime.transformation;

  revertedChampion.runtime.hookEffects = mergeHookEffects(
    defaultHookEffects,
    sourceChampion.runtime?.hookEffects,
  );

  combat.replaceActiveChampion(revertedChampion);

  return revertedChampion;
}
