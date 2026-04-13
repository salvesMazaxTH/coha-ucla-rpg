import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const theopetraSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "golpe_petreo",
    name: "Golpe Pétreo",
    bf: 70,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return `Theópetra desfere um golpe de pedra, causando dano ao inimigo.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
  {
    key: "muralha_ancestral",
    name: "Muralha Ancestral",
    priority: 1,
    description() {
      return `Theópetra ergue uma barreira, aumentando sua Defesa em 30% por 2 turnos.`;
    },
    targetSpec: ["self"],
    resolve({ user, context }) {
      return user.modifyStat({
        statName: "Defense",
        amount: 30,
        duration: 2,
        isPercent: true,
        context,
        statModifierSrc: "muralha_ancestral",
      });
    },
  },
  {
    key: "magnitude_11",
    name: "Magnitude 11",
    bf: 85,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    ultCost: 3,
    priority: 0,
    description() {
      return `Theópetra invoca a magnitude 11, causando dano massivo a todos os inimigos.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      for (const enemy of enemies) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        results.push(damageResult);
      }
      return results;
    },
  },
];

export default theopetraSkills;
