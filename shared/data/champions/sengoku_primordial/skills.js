import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicBlock from "../basicBlock.js";

const sengokuPrimordialSkills = [
  basicBlock,
  {
    key: "garra_primordial",
    name: "Garra Primordial",
    bf: 95,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return `Sengoku rasga o inimigo com suas garras dracônicas, causando dano elevado.`;
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
    key: "sopro_cataclismico",
    name: "Sopro Cataclísmico",
    bf: 130,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    ultCost: 2,
    priority: 0,
    description() {
      return `Sengoku expele fogo primordial sobre todos os inimigos.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      return enemies.map((enemy) => {
        const baseDamage = (user.Attack * this.bf) / 100;
        return new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
      });
    },
  },
];

export default sengokuPrimordialSkills;
