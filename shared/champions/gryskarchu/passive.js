import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Fonte da Vida",
  selfHeal: 15,
  hpThreshold: 50,
  defBonus: 10,
  description() {
    return `Sempre que Gryskarchu curar um aliado, ele próprio recupera ${this.selfHeal} HP (o excesso de cura é convertido em aumento do HP máximo para Gryskarchu). Se o aliado estava abaixo de ${this.hpThreshold}% do HP, Gryskarchu recebe +${this.defBonus} DEF.`;
  },
  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    if (healSrc?.id !== owner.id) return;
    if (healTarget.team !== owner.team) return;
    if (healTarget.id === owner.id) return; // impede auto-trigger, evita loop infinito

    const selfHealAmount = Math.round(amount / 5) * 5;
    if (selfHealAmount <= 0) return;

    const before = owner.HP;
    // Cura normalmente
    const applied = owner.heal(selfHealAmount, context);
    if (applied <= 0) return;

    // Calcula overheal real
    const potentialTotal = before + selfHealAmount;
    const overheal = Math.max(0, potentialTotal - owner.maxHP);

    let log = `[PASSIVA — Fonte da Vida] ${formatChampionName(owner)} recuperou ${applied} HP.`;

    // excesso ?
    if (overheal > 0) {
      owner.modifyHP(overheal, {
        context: {
          ...context,
          source: "passiva-fonte-da-vida-overheal",
        },
        affectMax: true,
        isPermanent: true,
      });
    }

    if (healTarget.HP < healTarget.maxHP * (this.hpThreshold / 100)) {
      owner.modifyStat({
        statName: "Defense",
        amount: this.defBonus,
        context: {
          ...context,
          source: "passiva-fonte-da-vida",
        },
        isPermanent: true,
      });
      log += ` ${formatChampionName(healTarget)} estava abaixo de ${this.hpThreshold}% HP, então ${formatChampionName(owner)} ganhou +${this.defBonus} DEF!`;
    }

    return { log };
  },
};
