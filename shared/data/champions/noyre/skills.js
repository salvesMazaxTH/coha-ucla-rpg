import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

const noyreSkills = {
  key: "distorcao_entropica",
  name: "Distorção Entrópica",

  damageMode: "standard",
  bf: 65,

  priority: 2,

  dmgBonus: 40,

  description() {
    return `Reduz o ultômetro do alvo em 2 unidades. Se o alvo tiver 3 barras ou mais de ult, causa ${this.dmgBonus}% a mais de dano.`;
  },

  targetSpec: ["enemy"],

  resolve({ user, targets, context, resolver }) {
    const [target] = targets;

    // 🔹 reduzir ult
    resolver.applyResourceChange({
      target,
      amount: -2,
      context,
      sourceId: user.id,
    });

    // 🔹 checar condição (3 barras = 12 unidades)
    const hasHighUlt = target.ultMeter >= 12;

    const damage = hasHighUlt
      ? Math.floor(((user.Attack * this.bf) / 100) * (1 + this.dmgBonus / 100))
      : Math.floor((user.Attack * this.bf) / 100);

    new DamageEvent({
      baseDamage: damage,
      attacker: user,
      defender: target,
      skill: this,
      context,
      allChampions: context.allChampions,
    }).execute();

    return {
      log: hasHighUlt
        ? `${user.name} distorceu a energia de ${target.name} (dano amplificado).`
        : `${user.name} distorceu a energia de ${target.name}.`,
    };
  },
};

export default noyreSkills;