export default {
  name: "Massa Inamolgável",
  stacksNeeded: 2,
  defBonus: 15,
  hpBonus: 10,
  description() {
    return `Sempre que Tharox tomar dano, ele ganha 1 acúmulo de Inércia. Ao chegar a ${this.stacksNeeded}, consome ambos e ganha +${this.defBonus} Defesa e +${this.hpBonus} HP (aumenta a vida).`;
  },
  afterDamageTaken({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (owner?.id !== dmgReceiver?.id) return;
    if (damage <= 0) return;

    owner.runtime.tharoxInerciaStacks =
      (owner.runtime.tharoxInerciaStacks || 0) + 1;

    if (owner.runtime.tharoxInerciaStacks < this.stacksNeeded) {
      return {
        log: `[Passiva - Massa Inamolgável] ${owner.name} acumulou Inércia (${owner.runtime.tharoxInerciaStacks}/${this.stacksNeeded}).`,
      };
    }

    owner.runtime.tharoxInerciaStacks = 0;

    const statResult = owner.modifyStat({
      statName: "Defense",
      amount: this.defBonus,
      context,
      isPermanent: true,
    });

    owner.modifyHP(this.hpBonus, { affectMax: true });

    let log = `[Passiva - Massa Inamolgável] ${owner.name} consumiu ${this.stacksNeeded} Inércia e ganhou +${this.defBonus} Defesa e +${this.hpBonus} HP! (Defesa: ${owner.Defense}, HP: ${owner.HP}/${owner.maxHP})`;

    if (statResult?.log) {
      log += `\n${statResult.log}`;
    }

    return { log };
  },
};
