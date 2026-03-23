// Centralização do Disparo Básico (ranged global)
import { DamageEvent } from "../../engine/combat/DamageEvent.js";

const basicShot = {
  key: "disparo_basico",
  name: "Disparo Básico",
  bf: 20,
  bonusFlat: 20,
  contact: false,
  damageMode: "standard",
  priority: 0,
  description() {
    return `\n Disparo básico genérico, físico e à distância (BF ${this.bf} + ${this.bonusFlat} bônus flat).`;
  },
  targetSpec: ["enemy"],
  resolve({ user, targets, context = {} }) {
    const [enemy] = targets;
    const baseDamage = (user.Attack * this.bf) / 100 + this.bonusFlat;
    return new DamageEvent({
      baseDamage,
      attacker: user,
      defender: enemy,
      skill: this,
      context,
      allChampions: context?.allChampions,
    }).execute();
  },
};

export default basicShot;
