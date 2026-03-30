import { formatChampionName } from "../../../ui/formatters.js";

export default {
  name: "Massa Inamolgável",
  stacksNeeded: 2,
  defBonus: 15,
  hpBonus: 10,
  description() {
    return `Sempre que Tharox tomar dano, ele ganha 1 acúmulo de Inércia. Ao chegar a ${this.stacksNeeded}, consome ambos e ganha +${this.defBonus} Defesa e +${this.hpBonus} HP (aumenta a vida).`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;

    owner.runtime.tharoxInerciaStacks =
      (owner.runtime.tharoxInerciaStacks || 0) + 1;

    if (owner.runtime.tharoxInerciaStacks < this.stacksNeeded) {
      return {
        log: `<b>[Passiva - Massa Inamolgável]</b> ${formatChampionName(owner)} acumulou Inércia (${owner.runtime.tharoxInerciaStacks}/${this.stacksNeeded}).`,
      };
    }

    owner.runtime.tharoxInerciaStacks = 0;

    const statResult = owner.modifyStat({
      statName: "Defense",
      amount: this.defBonus,
      context,
      isPermanent: true,
    });

    owner.modifyHP(this.hpBonus, { context, affectMax: true, isPermanent: true });

    let log = `<b>[Passiva - Massa Inamolgável]</b> ${formatChampionName(owner)} consumiu ${this.stacksNeeded} Inércia e ganhou +${this.defBonus} Defesa e +${this.hpBonus} HP! (Defesa: ${owner.Defense}, HP: ${owner.HP}/${owner.maxHP})`;

    if (statResult?.log) {
      log += `\n${statResult.log}`;
    }

    return { log };
  },

  onTurnEnd({ owner, context }) {
    if (context.currentTurn !== owner.runtime.lastTauntTurn) {
      owner.runtime.tauntStreak = 0;
      // console.log(`[HOOK - onTurnEnd] ${owner.name} não usou Taunt no turno anterior. Taunt Streak resetada. ${owner.runtime.tauntStreak}`); // Log para debug
    }
  },
};
