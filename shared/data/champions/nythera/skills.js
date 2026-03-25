import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const nytheraSkills = [
  basicStrike,
  {
    key: "lamina_boreal",
    name: "Lâmina Boreal",
    bf: 75,

    chillDuration: 2,
    freezeDuration: 1,
    bonusIfFrozen: 50,

    contact: false,
    priority: 0,

    element: "ice",
    description() {
      return `Causa dano e deixa o alvo Gelado por ${this.chillDuration} turno(s). Se o alvo já estiver Gelado, aplica Congelado por ${this.freezeDuration} turno(s) e causa dano adicional igual a ${this.bonusIfFrozen} de dano (Perfurante).`;
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
    freezeDuration: 2,

    priority: 3,
    element: "ice",
    description() {
      return `Por ${this.effectDuration} turno(s), recebe -40 de redução de dano. Quem causar dano a Nythera durante esse período fica Congelado por ${this.freezeDuration} turno(s).`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.applyDamageReduction({
        amount: 40,
        duration: this.effectDuration,
        source: "Câmara de Estase",
        context,
      });

      const freezeDuration = this.freezeDuration;

      user.runtime.hookEffects ??= [];

      if (!user.runtime.hookEffects)
        throw new Error("NYTHERA: HookEffects não inicializado corretamente.");

      const effect = {
        key: "camara_de_estase",
        expiresAt: context?.currentTurn + this.effectDuration,

        hookScope: {
          onAfterDmgTaking: "defender",
        },

        onAfterDmgTaking({ attacker, defender, damage, context }) {
          attacker.applyStatusEffect("congelado", freezeDuration, context);
        },
      };

      user.runtime.hookEffects.push(effect);
    },
  },

  {
    key: "trono_da_noite_branca",
    name: "Trono da Noite Branca",
    bf: 70,

    chillDuration: 2,
    freezeDuration: 1,
    bfIfCold: 110,
    bonusIfFrozen: 50,

    contact: false,
    priority: 1,

    isUltimate: true,
    ultCost: 3,

    element: "ice",
    description() {
      return `Se o alvo estiver Gelado ou Congelado, o BF aumenta para ${this.bfIfCold} e aplica Congelado por ${this.freezeDuration} turno(s). Se já estiver Congelado, causa também ${this.bonusIfFrozen} de dano adicional.
      Caso contrário, aplica Gelado por ${this.chillDuration} turno(s).`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [target] = targets;

      const isFrozen = target.hasStatusEffect("congelado");
      const isChilled = target.hasStatusEffect("gelado");

      let baseDamage;

      // BF base
      if (isChilled || isFrozen) {
        baseDamage = (user.Attack * this.bfIfCold) / 100;
      } else {
        baseDamage = (user.Attack * this.bf) / 100;
      }

      // bônus adicional se já estiver congelado
      if (isFrozen) {
        baseDamage += this.bonusIfFrozen;
      }

      // aplicar status depois
      if (!isChilled && !isFrozen) {
        target.applyStatusEffect("gelado", this.chillDuration, context);
      } else if (isChilled && !isFrozen) {
        target.applyStatusEffect("congelado", this.freezeDuration, context);
      }

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default nytheraSkills;
