// Centralização do Ataque Básico idêntico ao dos skills dos campeões
import { DamageEvent } from "../../engine/combat/DamageEvent.js";

const basicAttack = {
  key: "ataque_basico",
  name: "Ataque Básico",
  bf: 20,
  bonusFlat: 20,
  contact: true,
  damageMode: "standard",
  priority: 0,
  description() {
    return `\n Ataque básico genérico (BF ${this.bf} + ${this.bonusFlat} bônus flat).`;
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

export default basicAttack;
