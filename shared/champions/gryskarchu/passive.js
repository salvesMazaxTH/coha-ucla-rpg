import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Fonte da Vida",
  selfHeal: 15,
  hpThreshold: 50,
  defBonus: 10,
  description() {
    return `Sempre que Gryskarchu curar um aliado, ele próprio recupera ${this.selfHeal} HP (o excesso de cura é convertido em aumento do HP máximo para Gryskarchu). Se o aliado estava abaixo de ${this.hpThreshold}% do HP, Gryskarchu recebe +${this.defBonus} DEF.`;
  },
  onHeal({ target, amount, self, context }) {
    if (target.team !== self.team) return;

    const heal = Math.round(amount / 5) * 5;
    if (heal <= 0) return;
    self.heal(heal, context);
    // excesso ?
    const excess = Math.max(0, self.HP - self.maxHP);
    if (excess > 0) {
      self.modifyHP(excess, { affectMax: true });
    }

    let log = `[PASSIVA — Fonte da Vida] ${formatChampionName(self)} recuperou ${heal} HP.`;

    if (target.HP < target.maxHP * (this.hpThreshold / 100)) {
      self.modifyStat({
        statName: "Defense",
        amount: this.defBonus,
        context: { source: "passiva-fonte-da-vida" },
        isPermanent: true,
      });
      log += ` ${formatChampionName(target)} estava abaixo de ${this.hpThreshold}% HP, então ${formatChampionName(self)} ganhou +${this.defBonus} DEF!`;
    }

    return { log };
  },
};
