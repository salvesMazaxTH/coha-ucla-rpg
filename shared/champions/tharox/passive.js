export default {
  name: "Massa Inamolgável",
  stacksNeeded: 2,
  defBonus: 15,
  hpBonus: 10,
  description() {
    return `Sempre que Tharox tomar dano, ele ganha 1 acúmulo de Inércia. Ao chegar a ${this.stacksNeeded}, consome ambos e ganha +${this.defBonus} Defesa e +${this.hpBonus} HP (aumenta a vida).`;
  },
  afterDamageTaken({ target, damage, context, attacker, self }) {
    if (self !== target) return;
    if (damage <= 0) return;

    self.runtime.tharoxInerciaStacks =
      (self.runtime.tharoxInerciaStacks || 0) + 1;

    if (self.runtime.tharoxInerciaStacks < this.stacksNeeded) {
      return {
        log: `[Passiva - Massa Inamolgável] ${self.name} acumulou Inércia (${self.runtime.tharoxInerciaStacks}/${this.stacksNeeded}).`,
      };
    }

    self.runtime.tharoxInerciaStacks = 0;

    const statResult = self.modifyStat({
      statName: "Defense",
      amount: this.defBonus,
      context,
      isPermanent: true,
    });

    self.modifyHP(this.hpBonus, { affectMax: true });

    let log = `[Passiva - Massa Inamolgável] ${self.name} consumiu ${this.stacksNeeded} Inércia e ganhou +${this.defBonus} Defesa e +${this.hpBonus} HP! (Defesa: ${self.Defense}, HP: ${self.HP}/${self.maxHP})`;

    if (statResult?.log) {
      log += `\n${statResult.log}`;
    }

    return { log };
  },
};
