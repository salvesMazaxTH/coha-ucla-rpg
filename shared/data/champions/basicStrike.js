// Centralização do Golpe Básico (melee global)
import { DamageEvent } from "../../engine/combat/DamageEvent.js";

const basicStrike = {
  key: "golpe_basico",
  name: "Golpe Básico",
  bf: 20,
  bonusFlat: 20,
  contact: true,
  damageMode: "standard",
  priority: 0,
  description() {
    return `\n Golpe básico genérico, físico e faz contato (BF ${this.bf} + ${this.bonusFlat} bônus flat).`;
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
      type: "physical",
      context,
      allChampions: context?.allChampions,
    }).execute();
  },
};

export default basicStrike;
