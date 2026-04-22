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
    return `\n Disparo básico genérico, à distância (BF ${this.bf} + ${this.bonusFlat} bônus flat). Pode ser físico ou mágico, dependendo do campeão.`;
  },
  targetSpec: ["enemy"],
  resolve({ user, targets, context = {} }) {
    const [enemy] = targets;
    const baseDamage = (user.Attack * this.bf) / 100 + this.bonusFlat;
    // Permite customizar por campeão via override da skill: { ...basicShot, type: "..." }
    const type = this.type || "physical";
    return new DamageEvent({
      baseDamage,
      attacker: user,
      defender: enemy,
      skill: this,
      type,
      context,
      allChampions: context?.allChampions,
    }).execute();
  },
};

export default basicShot;
