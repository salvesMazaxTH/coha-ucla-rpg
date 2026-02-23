// Centralização do Ataque Básico idêntico ao dos skills dos campeões
import { CombatResolver } from "../core/combatResolver.js";

const basicAttack = {
  key: "ataque_basico",
  name: "Ataque Básico",
  bf: 15,
  bonusFlat: 20,
  contact: true,
  manaCost: 0,
  priority: 0,
  description() {
    return `Custo: ${this.manaCost} MP\nAtaque básico genérico (BF ${this.bf} + ${this.bonusFlat} bônus flat).\nContato: ${this.contact ? "✅" : "❌"}`;
  },
  targetSpec: ["enemy"],
  execute({ user, targets, context = {} }) {
    const { enemy } = targets;
    const baseDamage = (user.Attack * this.bf) / 100 + this.bonusFlat;
    return CombatResolver.processDamageEvent({
      baseDamage,
      user,
      target: enemy,
      skill: this,
      context,
      allChampions: context?.allChampions,
    });
  },
};

export default basicAttack;
