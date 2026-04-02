import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";
import basicStrike from "../basicStrike.js";

const tutuSkills = [
  basicBlock,
  basicStrike,
  {
    key: "investida_protetora",
    name: "Investida Protetora",
    bf: 85,
    contact: true,

    shieldAmount: 30,

    priority: 0,
    damageMode: "standard",

    description() {
      return `Tutu avança, causando dano ao inimigo e protegendo o aliado com menor HP com um Escudo de ${this.shieldAmount} pontos.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(damageResult);

      const lowestHealthAlly = context.aliveChampions
        .filter((c) => c.team === user.team && c.id !== user.id)
        .sort((a, b) => a.HP / a.maxHP - b.HP / b.maxHP)[0];

      if (lowestHealthAlly) {
        lowestHealthAlly.addShield(this.shieldAmount, 0, context);
      }

      return results;
    },
  },

  {
    key: "provocacao_instintiva",
    name: "Provocação Instintiva",

    tauntDuration: 1,

    priority: 3,

    description() {
      return `Tutu avança, provocando o inimigo por ${this.tauntDuration} turno(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);

      const logs = [tauntLog].filter(Boolean);
      logs.unshift({
        log: `${formatChampionName(user)} executou <b>Provocação Instintiva</b>. ${formatChampionName(enemy)} foi provocado por ${this.tauntDuration} turno(s).`,
      });
      return logs;
    },
  },
];

export default tutuSkills;
