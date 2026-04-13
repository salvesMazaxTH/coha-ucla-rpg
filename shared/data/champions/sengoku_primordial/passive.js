import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "coracao_primordial",
  name: "Coração Primordial",
  attackGain: 25,
  defenseGain: 15,
  description() {
    return `No início de cada turno, Sengoku Primordial ganha +${this.attackGain} de Ataque e +${this.defenseGain} de Defesa enquanto a transformação durar.`;
  },
  onTurnStart({ owner, context }) {
    owner.Attack += this.attackGain;
    owner.Defense += this.defenseGain;

    context.registerDialog({
      message: `[PASSIVA — Coração Primordial] ${formatChampionName(owner)} fortaleceu seu corpo dracônico.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `[PASSIVA — Coração Primordial] ${formatChampionName(owner)} ganhou +${this.attackGain} de Ataque e +${this.defenseGain} de Defesa.`,
    };
  },
};
