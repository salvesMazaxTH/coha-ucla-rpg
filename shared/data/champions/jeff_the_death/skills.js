import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const jeffTheDeathSkills = [
  // =========================
  // Ataque Básico
  // =========================

  basicStrike,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "golpe_funebre",
    name: "Golpe Fúnebre",

    bf: 35,
    contact: true,
    damageMode: "piercing",
    priority: 0,

    description() {
      return `Jeff causa dano perfurante no alvo inimigo escolhido. Se Jeff já morreu, esta habilidade também causa dano aos campeões adjacentes.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime.deathCounter ??= 0;

      const results = [];

      // 🎯 PRIMARY
      const primaryResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPortion: baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(primaryResult);

      // 🧠 Se não tiver stacks, acabou
      if (user.runtime.deathCounter <= 0) return results;

      const adjacentEnemies = context.getAdjacentChampions(enemy) || [];

      // 🎯 Para cada adjacente, cria um resultado
      for (const adjEnemy of adjacentEnemies) {
        const result = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPortion: baseDamage,
          attacker: user,
          defender: adjEnemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(result);
      }

      return results;
    },
  },
];

export default jeffTheDeathSkills;
