import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicStrike from "../basicStrike.js";

const toxViprannaSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicStrike,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "skill1",
    name: "skill1",
    bf: 90,
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],
    description() {
      return "skill1_description";
    },
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
  {
    key: "skill2",
    name: "skill2",
    bf: 110,
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],
    description() {
      return "skill2_description";
    },
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
  {
    key: "skill3",
    name: "skill3",
    bf: 130,
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],
    description() {
      return "skill3_description";
    },
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
  {
    key: "ultimate",
    name: "ultimate",
    bf: 220,
    contact: true,
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    ultCost: 5,
    targetSpec: ["enemy"],
    description() {
      return "ultimate_description";
    },
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default toxViprannaSkills;
