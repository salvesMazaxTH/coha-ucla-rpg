import { Champion } from "../shared/core/Champion.js";
import { championDB } from "../shared/data/championDB.js";

function parseArgs(argv) {
  const out = {
    attacker: "theopetra",
    defender: "bruno",
    skill: "golpe_petreo",
    turn: 1,
    stacks: null,
    comparePassive: false,
    showJson: false,
    attackerAttack: null,
    defenderDefense: null,
    noPassive: false,
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

function createContext({ allChampions, turn }) {
  const activeChampions = new Map(allChampions.map((c) => [c.id, c]));

  return {
    currentTurn: turn,
    isDot: false,
    logs: [],
    dialogs: [],
    damageEvents: [],
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
    registerHeal(entry) {
      this.heals.push(entry);
    },
    registerBuff(entry) {
      this.buffs.push(entry);
    },
    registerShield(entry) {
      this.shields.push(entry);
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

  if (options.stacks != null) {
    attacker.runtime = attacker.runtime || {};
    attacker.runtime.theopetraStacks = options.stacks;
  }

  const context = createContext({
    allChampions: [attacker, defender],
    turn: options.turn,
  });
  const skill = getSkill(attacker, options.skill);

  const initialStacks = attacker.runtime?.theopetraStacks ?? 0;
  const baseDamage = estimateSkillBaseDamage(attacker, skill);

  const result = skill.resolve({
    user: attacker,
    targets: [defender],
    context,
  });

  const mainResult = Array.isArray(result) ? result[0] : result;

  const summary = {
    tag,
    attacker: attacker.name,
    defender: defender.name,
    skill: skill.key,
    baseDamage,
    stacksBefore: initialStacks,
    stacksAfter: attacker.runtime?.theopetraStacks ?? 0,
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
  console.log(`Stacks: ${summary.stacksBefore} -> ${summary.stacksAfter}`);
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

  if (options.comparePassive) {
    const probe = pickChampion(options.attacker, "probe", "player1", 0);
    const maxStacks = probe.passive?.maxStacks ?? 0;

    const noStackSummary = runScenario(
      { ...options, stacks: 0 },
      "No passive stacks",
    );
    const fullStackSummary = runScenario(
      { ...options, stacks: maxStacks },
      `Passive ready (${maxStacks} stacks)`,
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
