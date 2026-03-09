import { DamageEvent } from "../../engine/combat/damagePipeline/DamageEvent.js";
import { formatChampionName } from "../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const nytheraSkills = [
  basicAttack,
  {
    key: "lamina_boreal",
    name: "Lâmina Boreal",
    bf: 75,
    contact: false,
    chillDuration: 2,
    freezeDuration: 1,
    bonusIfFrozen: 50,
    description() {
      return `Causa dano e deixa o alvo {gelado} por ${this.chillDuration} turno(s). Se o alvo já estiver {gelado}, aplica {congelado} por ${this.freezeDuration} turno(s) e causa dano adicional igual a ${this.bonusIfFrozen} de dano ({perfurante}).`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      let totalDamage = baseDamage;

      const isFrozen = target.hasStatusEffect("congelado");

      if (isFrozen) {
        totalDamage += (baseDamage * this.bonusIfFrozen) / 100;
        target.applyStatusEffect("congelado", this.freezeDuration, context);
      } else {
        target.applyStatusEffect("gelado", this.chillDuration, context);
      }

      return new DamageEvent({
        baseDamage: totalDamage,
        user,
        target,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default nytheraSkills;
