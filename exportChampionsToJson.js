import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const championsDir = "./shared/champions";
const outputFile = "./champions_db.json";

const ignoredChampions = [
    "laisaelis",
    "laiserisa",
    "laisaelis_laiserisa",
];

function getDescription(desc) {
  if (typeof desc === "string") return desc;

  if (typeof desc === "function") {
    try {
      const str = desc.toString();

      const match = str.match(/return\s+`([^`]+)`/);

      if (match) {
        return match[1];
      }

      return "[Dynamic Description]";
    } catch {
      return "[Dynamic Description]";
    }
  }

  return "";
}

async function loadChampion(champPath) {
  const indexPath = path.join(champPath, "index.js");

  const module = await import(pathToFileURL(indexPath));
  const champ = module.default;

  const skills = champ.skills.map((skill, i) => {
    let slot = i;

    if (i === 0) slot = "basic";
    if (skill.isUltimate) slot = "ultimate";

    return {
      slot,
      name: skill.name || "Unknown",
      description: getDescription(skill.description),
      cost: skill.ultCost || 0,
      bf: skill.bf || skill.bfPrimary || 0,
      priority: skill.priority || 0,
      contact: skill.contact || false,
      extra: "",
    };
  });

  return {
    id: champ.name.toLowerCase(),
    name: champ.name,
    image: champ.portrait,
    stats: {
      hp: champ.HP,
      resourceType: "Energia",
      resource: 0,
      attack: champ.Attack,
      defense: champ.Defense,
      speed: champ.Speed,
      crit: champ.Critical || null,
      evasion: null,
      lifesteal: null,
    },
    passive: {
      name: champ.passive.name,
      description: getDescription(champ.passive.description),
    },
    skills,
  };
}

async function main() {
  const folders = fs.readdirSync(championsDir);

  const champions = [];

  for (const folder of folders) {
    try {
      const champPath = path.join(championsDir, folder);

      if (!fs.statSync(champPath).isDirectory()) continue;

      console.log("Processing:", folder);

      const champ = await loadChampion(champPath);

      champions.push(champ);
    } catch (err) {
      console.error(`Error processing ${folder}:`, err);
    }
  }

  const output = { champions };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log("champions_db.json generated!");
}

main();
