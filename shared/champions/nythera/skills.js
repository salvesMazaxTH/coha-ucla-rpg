import { DamageEvent } from "../../engine/DamageEvent.js";
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
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "camara_de_estase",
    name: "Câmara de Estase",
    effectDuration: 2,
    contact: false,
    chillDuration: 2,
    freezeDuration: 1,

    priority: 3,
    element: "water",
    description() {
      return `Por ${this.effectDuration} turno(s), recebe -40 de redução de dano. Quem causar dano a Nythera durante esse período recebe {gelado} por ${this.chillDuration} turno(s). Se o alvo já estiver {gelado}, aplica {congelado} por ${this.freezeDuration} turno(s).`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.applyDamageReduction(
        user,
        { config: { amount: 40, duration: this.effectDuration, source: this } },
        context,
      );

      user.runtime.hookEffects ??= [];

      if (!user.runtime.hookEffects)
        throw new Error("NYTHERA: HookEffects não inicializado corretamente.");

      const effect = {
        key: "camara_de_estase",
        expiresAt: context?.currentTurn + this.effectDuration,
        onAfterDmgTaking({ source, target, damage, context }) {
          source.hasStatusEffect("congelado")
            ? source.applyStatusEffect(
                "congelado",
                this.freezeDuration,
                context,
              )
            : source.applyStatusEffect("gelado", this.chillDuration, context);
        },
      };

      user.runtime.hookEffects.push(effect);
    },
  },
];

export default nytheraSkills;
