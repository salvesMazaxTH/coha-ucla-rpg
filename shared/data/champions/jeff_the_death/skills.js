import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const jeffTheDeathSkills = [
  // =========================
  // Ataque Básico
  // =========================

  basicAttack,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "golpe_funebre",
    name: "Golpe Fúnebre",

    bf: 35,
    contact: true,
    damageMode: "hybrid",
    priority: 0,

    description() {
      return `Jeff causa dano perfurante no alvo inimigo escolhido. Se Jeff já morreu, esta habilidade também causa dano aos campeões adjacentes.`;
    },
  },
];

export default jeffTheDeathSkills;
