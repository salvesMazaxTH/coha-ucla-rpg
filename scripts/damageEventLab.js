import { Champion } from "../shared/core/Champion.js";
import { emitCombatEvent } from "../shared/engine/combat/combatEvents.js";
import { championDB } from "../shared/data/championDB.js";

function parseValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && raw.trim() !== "") return asNumber;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseAssignment(raw) {
  const eqIndex = raw.indexOf("=");
  if (eqIndex <= 0) {
    throw new Error(
      `Invalid assignment '${raw}'. Use format path=value (ex: runtime.foo=3).`,
    );
  }

  const path = raw.slice(0, eqIndex).trim();
  const value = parseValue(raw.slice(eqIndex + 1).trim());

  if (!path) {
    throw new Error(`Invalid assignment '${raw}': path cannot be empty.`);
  }

  return { path, value };
}

function setPath(target, path, value) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) throw new Error(`Invalid path '${path}'.`);

  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function getPath(target, path) {
  const parts = path.split(".").filter(Boolean);
  let cursor = target;

  for (const key of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[key];
  }

  return cursor;
}

function applyAssignments(target, assignments) {
  for (const assignment of assignments) {
    setPath(target, assignment.path, assignment.value);
  }
}

function resolveRootByPath(path, scope) {
  if (path.startsWith("attacker.")) {
    return {
      root: scope.attacker,
      localPath: path.slice("attacker.".length),
    };
  }

  if (path.startsWith("defender.")) {
    return {
      root: scope.defender,
      localPath: path.slice("defender.".length),
    };
  }

  if (path.startsWith("context.")) {
    return {
      root: scope.context,
      localPath: path.slice("context.".length),
    };
  }

  throw new Error(
    `Path '${path}' must start with attacker., defender. or context.`,
  );
}

function parseArgs(argv) {
  const out = {
    attacker: "tharox",
    defender: "bruno",
    skill: "impacto_da_couraça",
    turn: 1,
    stacks: null,
    comparePassive: false,
    comparePath: null,
    compareMin: 0,
    compareMax: null,
    showJson: false,
    attackerAttack: null,
    defenderDefense: null,
    noPassive: false,
    // Defaults hardcoded for quick local repro: Tharox ultado -> Impacto da Couraca.
    preSkills: ["apoteose_do_monolito", "apoteose_do_monolito"],
    attackerSet: [],
    defenderSet: [],
    contextSet: [],
    track: ["attacker.Defense", "attacker.maxHP", "attacker.HP", "defender.HP"],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[i + 1];

    if (key === "compare-passive") {
      out.comparePassive = true;
      continue;
    }

    if (key === "track") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --track");
      }
      out.track.push(next);
      i += 1;
      continue;
    }

    if (key === "pre-skill") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --pre-skill");
      }
      out.preSkills.push(next);
      i += 1;
      continue;
    }

    if (key === "attacker-set") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --attacker-set");
      }
      out.attackerSet.push(parseAssignment(next));
      i += 1;
      continue;
    }

    if (key === "defender-set") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --defender-set");
      }
      out.defenderSet.push(parseAssignment(next));
      i += 1;
      continue;
    }

    if (key === "context-set") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --context-set");
      }
      out.contextSet.push(parseAssignment(next));
      i += 1;
      continue;
    }

    if (key === "show-json") {
      out.showJson = true;
      continue;
    }

    if (key === "no-passive") {
      out.noPassive = true;
      continue;
    }

    if (next == null || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    if (key === "attacker") out.attacker = next;
    else if (key === "defender") out.defender = next;
    else if (key === "skill") out.skill = next;
    else if (key === "turn") out.turn = Number(next);
    else if (key === "stacks") out.stacks = Number(next);
    else if (key === "compare-path") out.comparePath = next;
    else if (key === "compare-min") out.compareMin = Number(next);
    else if (key === "compare-max") out.compareMax = Number(next);
    else if (key === "attacker-attack") out.attackerAttack = Number(next);
    else if (key === "defender-defense") out.defenderDefense = Number(next);
    else throw new Error(`Unknown option: --${key}`);

    i += 1;
  }

  return out;
}

function pickChampion(key, id, team, slot) {
  const baseData = championDB[key];
  if (!baseData) {
    const available = Object.keys(championDB).sort().join(", ");
    throw new Error(`Champion '${key}' not found. Available: ${available}`);
  }

  return Champion.fromBaseData(baseData, id, team, { combatSlot: slot });
}

function createContext({ allChampions, turn, sourceId }) {
  const activeChampions = new Map(allChampions.map((c) => [c.id, c]));

  return {
    currentTurn: turn,
    statModifierSrcId: sourceId ?? null,
    healSourceId: sourceId ?? null,
    isDot: false,
    logs: [],
    dialogs: [],
    damageEvents: [],
    resourceChanges: [],
    heals: [],
    buffs: [],
    shields: [],
    extraDamageQueue: [],
    allChampions: activeChampions,
    activeChampions,
    registerDialog(entry) {
      this.dialogs.push(entry);
    },
    registerDamage(entry) {
      this.damageEvents.push(entry);
    },
    registerResourceChange(entry) {
      this.resourceChanges.push(entry);
    },
    registerHeal(entry) {
      this.heals.push(entry);

      const sourceChamp =
        this.activeChampions.get(entry?.sourceId) || entry?.target || null;

      emitCombatEvent(
        "onAfterHealing",
        {
          healSrc: sourceChamp,
          healTarget: entry?.target || null,
          amount: Number(entry?.amount) || 0,
          context: this,
        },
        this.allChampions,
      );
    },
    registerBuff(entry) {
      this.buffs.push(entry);
    },
    registerShield(entry) {
      this.shields.push(entry);
    },
  };
}

function createLabResolver({ activeChampions }) {
  return {
    combat: {
      activeChampions,
    },
    applyResourceChange({
      target,
      amount,
      context,
      sourceId,
      emitHooks = true,
    }) {
      if (!target || amount === 0) return 0;

      const applied =
        amount > 0 ? target.addUlt(amount) : target.spendUlt(amount);

      if (applied === 0) return 0;

      if (typeof context?.registerResourceChange === "function") {
        context.registerResourceChange({ target, amount: applied, sourceId });
      }

      if (!emitHooks) return applied;

      const eventType = applied > 0 ? "onResourceGain" : "onResourceSpend";
      const payloadType = applied > 0 ? "resourceGain" : "resourceSpend";

      emitCombatEvent(
        eventType,
        {
          target,
          owner: target,
          amount: Math.abs(applied),
          context,
          type: payloadType,
          resourceType: "ult",
          source: activeChampions.get(sourceId) || null,
          resolver: this,
        },
        activeChampions,
      );

      return applied;
    },
  };
}

function getSkill(champion, skillKey) {
  const skill = (champion.skills || []).find((s) => s.key === skillKey);
  if (!skill) {
    const keys = (champion.skills || []).map((s) => s.key).join(", ");
    throw new Error(
      `Skill '${skillKey}' not found on ${champion.name}. Available: ${keys}`,
    );
  }
  return skill;
}

function estimateSkillBaseDamage(attacker, skill) {
  if (!Number.isFinite(skill?.bf)) return null;
  return (attacker.Attack * skill.bf) / 100;
}

function resolveTargets({ user, defender, skill }) {
  const first = skill?.targetSpec?.[0];

  if (first === "self") return [user];
  if (first === "enemy") return [defender];
  if (first === "all:enemy") return [defender];

  return [defender];
}

function executeSkill({ user, defender, skill, context }) {
  const targets = resolveTargets({ user, defender, skill });
  const resolver = createLabResolver({
    activeChampions: context.activeChampions,
  });

  return skill.resolve({
    user,
    targets,
    context,
    resolver,
  });
}

function runScenario(options, tag) {
  const attacker = pickChampion(options.attacker, "p1-a", "player1", 0);
  const defender = pickChampion(options.defender, "p2-b", "player2", 0);

  if (options.attackerAttack != null) {
    attacker.Attack = options.attackerAttack;
    attacker.baseAttack = options.attackerAttack;
  }

  if (options.defenderDefense != null) {
    defender.Defense = options.defenderDefense;
    defender.baseDefense = options.defenderDefense;
  }

  if (options.noPassive) attacker.passive = null;

  applyAssignments(attacker, options.attackerSet || []);
  applyAssignments(defender, options.defenderSet || []);

  // Se for Naelys e mareStacks > 0, adiciona o damageModifier de Maré igual à passiva
  if (
    attacker.name === "Naelys" &&
    attacker.runtime &&
    typeof attacker.runtime.mareStacks === "number" &&
    attacker.runtime.mareStacks > 0
  ) {
    const alreadyHas = attacker
      .getDamageModifiers()
      .some((m) => m.id === "mare-stacks");
    if (!alreadyHas) {
      const passive = attacker.passive;
      attacker.addDamageModifier({
        id: "mare-stacks",
        name: "Maré",
        permanent: true,
        apply: ({ baseDamage, attacker: atk }) => {
          const stacks = Math.min(
            atk?.runtime?.mareStacks || 0,
            passive?.maxStacks || 4,
          );
          return baseDamage + stacks * (passive?.dmgPerStack || 10);
        },
      });
    }
  }

  if (options.stacks != null) {
    attacker.runtime = attacker.runtime || {};
    attacker.runtime.theopetraStacks = options.stacks;
  }

  const context = createContext({
    allChampions: [attacker, defender],
    turn: options.turn,
    sourceId: attacker.id,
  });

  applyAssignments(context, options.contextSet || []);

  const trackedBefore = [];
  for (const path of options.track || []) {
    const { root, localPath } = resolveRootByPath(path, {
      attacker,
      defender,
      context,
    });
    trackedBefore.push({ path, value: getPath(root, localPath) });
  }

  const skill = getSkill(attacker, options.skill);

  const preSkillQueue = Array.isArray(options.preSkills)
    ? options.preSkills
    : options.preSkills
      ? [options.preSkills]
      : [];

  const preSkillResults = [];
  for (const preSkillKey of preSkillQueue) {
    if (!preSkillKey || preSkillKey === "none") continue;
    // Só executa se a skill existir para o atacante
    const skillExists = (attacker.skills || []).some(
      (s) => s.key === preSkillKey,
    );
    if (!skillExists) continue;
    const preSkill = getSkill(attacker, preSkillKey);
    const preResult = executeSkill({
      user: attacker,
      defender,
      skill: preSkill,
      context,
    });
    preSkillResults.push({
      key: preSkillKey,
      result: preResult,
    });
  }

  const baseDamage = estimateSkillBaseDamage(attacker, skill);

  const result = executeSkill({
    user: attacker,
    defender,
    skill,
    context,
  });

  const mainResult = Array.isArray(result) ? result[0] : result;

  const trackedAfter = [];
  for (const path of options.track || []) {
    const { root, localPath } = resolveRootByPath(path, {
      attacker,
      defender,
      context,
    });
    trackedAfter.push({ path, value: getPath(root, localPath) });
  }

  const tracked = trackedBefore.map((entry, idx) => ({
    path: entry.path,
    before: entry.value,
    after: trackedAfter[idx]?.value,
  }));

  const summary = {
    tag,
    attacker: attacker.name,
    defender: defender.name,
    skill: skill.key,
    baseDamage,
    tracked,
    preSkills: preSkillResults,
    totalDamage: mainResult?.totalDamage ?? null,
    mitigatedDamage: mainResult?.journey?.mitigated ?? null,
    hpAfter: `${defender.HP}/${defender.maxHP}`,
    log: mainResult?.log ?? null,
    dialogs: context.dialogs,
    rawResult: result,
  };

  return summary;
}

function printSummary(summary) {
  console.log(`\n=== ${summary.tag} ===`);
  console.log(
    `${summary.attacker} -> ${summary.defender} | skill: ${summary.skill}`,
  );
  if (summary.baseDamage != null) {
    console.log(
      `Estimated baseDamage (bf x Attack): ${summary.baseDamage.toFixed(2)}`,
    );
  }

  if (summary.tracked.length) {
    console.log("Tracked fields:");
    for (const field of summary.tracked) {
      console.log(`- ${field.path}: ${field.before} -> ${field.after}`);
    }
  }

  if (summary.preSkills.length) {
    console.log("Pre-skills executed:");
    for (const step of summary.preSkills) {
      console.log(`- ${step.key}`);
    }
  }

  console.log(`Mitigated damage in pipeline: ${summary.mitigatedDamage}`);
  console.log(`Applied damage (HP delta): ${summary.totalDamage}`);
  console.log(`Defender HP after: ${summary.hpAfter}`);

  if (summary.log) {
    console.log("--- Log ---");
    console.log(summary.log);
  }

  if (summary.dialogs.length) {
    console.log("--- Dialogs ---");
    for (const d of summary.dialogs) {
      console.log(d.message);
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.stacks != null && !options.track.length) {
    options.track.push("attacker.runtime.theopetraStacks");
  }

  if (options.comparePassive) {
    const probe = pickChampion(options.attacker, "probe", "player1", 0);
    const comparePath =
      options.comparePath || "attacker.runtime.theopetraStacks";
    const compareMax =
      options.compareMax != null
        ? options.compareMax
        : (probe.passive?.maxStacks ?? 0);

    if (!Number.isFinite(compareMax)) {
      throw new Error(
        "Could not infer compare max value. Use --compare-max explicitly.",
      );
    }

    if (!options.track.includes(comparePath)) {
      options.track.push(comparePath);
    }

    const compareScenarioA = structuredClone(options);
    const compareScenarioB = structuredClone(options);

    const targetPathA = comparePath.replace(/^attacker\./, "");
    const targetPathD = comparePath.replace(/^defender\./, "");
    const targetPathC = comparePath.replace(/^context\./, "");

    if (comparePath.startsWith("attacker.")) {
      compareScenarioA.attackerSet.push({
        path: targetPathA,
        value: options.compareMin,
      });
      compareScenarioB.attackerSet.push({
        path: targetPathA,
        value: compareMax,
      });
    } else if (comparePath.startsWith("defender.")) {
      compareScenarioA.defenderSet.push({
        path: targetPathD,
        value: options.compareMin,
      });
      compareScenarioB.defenderSet.push({
        path: targetPathD,
        value: compareMax,
      });
    } else if (comparePath.startsWith("context.")) {
      compareScenarioA.contextSet.push({
        path: targetPathC,
        value: options.compareMin,
      });
      compareScenarioB.contextSet.push({
        path: targetPathC,
        value: compareMax,
      });
    } else {
      throw new Error(
        "--compare-path must start with attacker., defender. or context.",
      );
    }

    const noStackSummary = runScenario(
      compareScenarioA,
      `${comparePath} = ${options.compareMin}`,
    );
    const fullStackSummary = runScenario(
      compareScenarioB,
      `${comparePath} = ${compareMax}`,
    );

    printSummary(noStackSummary);
    printSummary(fullStackSummary);

    if (
      Number.isFinite(noStackSummary.totalDamage) &&
      Number.isFinite(fullStackSummary.totalDamage) &&
      noStackSummary.totalDamage > 0
    ) {
      const ratio = fullStackSummary.totalDamage / noStackSummary.totalDamage;
      console.log(`\nObserved final-damage ratio: ${ratio.toFixed(3)}x`);
    }

    if (options.showJson) {
      console.log("\n--- JSON ---");
      console.log(
        JSON.stringify({ noStackSummary, fullStackSummary }, null, 2),
      );
    }

    return;
  }

  const summary = runScenario(options, "Single scenario");
  printSummary(summary);

  if (options.showJson) {
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(summary, null, 2));
  }
}

main();
