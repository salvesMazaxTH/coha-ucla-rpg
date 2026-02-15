import { formatChampionName } from "../../core/formatters.js";

export default {
  name: "Fonte da Vida",
  description: `Sempre que Gryskarchu curar um aliado, ele próprio recupera 15 HP (o excesso de cura é convertido em aumento do HP máximo para Gryskarchu). Se o aliado estava abaixo de 50% do HP, Gryskarchu recebe +10 DEF.`,
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

    if (target.HP < target.maxHP * 0.5) {
      self.modifyStat({
        statName: "Defense",
        amount: 10,
        context: { source: "passiva-fonte-da-vida" },
        isPermanent: true,
      });
      log += ` ${formatChampionName(target)} estava abaixo de 50% HP, então ${formatChampionName(self)} ganhou +10 DEF!`;
    }

    return { log };
  },
};
