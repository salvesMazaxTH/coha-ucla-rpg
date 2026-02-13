export default {
  name: "Massa Inamolgável",
  description:
    "Sempre que Tharox tomar dano, ele ganha 1 acúmulo de Inércia. Ao chegar a 2, consome ambos e ganha +10 Defesa e +10 HP (cura e aumenta a vida máxima).",
  afterDamageTaken({ target, damage, context, attacker, self }) {
    if (self !== target) return;
    if (damage <= 0) return;

    self.runtime.tharoxInerciaStacks =
      (self.runtime.tharoxInerciaStacks || 0) + 1;

    if (self.runtime.tharoxInerciaStacks < 2) {
      return {
        log: `[Passiva - Massa Inamolgável] ${self.name} acumulou Inércia (${self.runtime.tharoxInerciaStacks}/2).`,
      };
    }

    self.runtime.tharoxInerciaStacks = 0;

    const statResult = self.modifyStat({
      statName: "Defense",
      amount: 10,
      context,
      isPermanent: true,
    });
    self.modifyHP(10, { affectMax: true });

    let log = `[Passiva - Massa Inamolgável] ${self.name} consumiu 2 Inércia e ganhou +10 Defesa e +10 HP! (Defesa: ${self.Defense}, HP: ${self.HP}/${self.maxHP})`;

    if (statResult?.log) {
      log += `\n${statResult.log}`;
    }

    return { log };
  },
};
