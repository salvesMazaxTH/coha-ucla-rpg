import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const blyskartriSkills = [
  basicStrike,
  {
    key: "fluxo_amplificador",
    name: "Fluxo Amplificador",
    speedBuff: 5,
    evasionBuff: 5,
    buffsDuration: 4,

    contact: false,
    priority: 3,

    description() {
      return `Concede +${this.speedBuff} Velocidade e +${this.evasionBuff} Esquiva por ${this.buffsDuration} turno(s).`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      /* console.log("[BLYSKARTRI][fluxo_restaurador] resolve", {
        caster: user?.name,
        ally: ally?.name,
        turn: context.currentTurn,
      });
      */

      ally.modifyStat({
        statName: "Speed",
        amount: 5,
        duration: this.buffsDuration,
        context,
      });

      ally.modifyStat({
        statName: "Evasion",
        amount: 10,
        duration: this.buffsDuration,
        context,
      });

      /* console.log("[BLYSKARTRI][fluxo_restaurador] buffs applied", {
        speedBuff: 5,
        evasionBuff: 10,
      });
      */

      return {
        log: `${formatChampionName(user)} energizou ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "condutancia_vital",

    name: "Condutância Vital",

    piercingDamageBonus: 50,

    priority: 1,

    speedBuff: 10,
    evasionBuff: 2,
    buffsDuration: 2,

    contact: false,

    description() {
      return `Concede ${this.speedBuff} Velocidade e triplica a Esquiva por ${this.buffsDuration} turnos.
      Enquanto tiver este efeito, sempre que o alvo Esquivar, causa ${this.piercingDamageBonus} de dano perfurante no agressor.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      /* console.log("[BLYSKARTRI][condutancia_vital] resolve", {
        caster: user?.name,
        ally: ally?.name,
        turn: context.currentTurn,
      });
      */

      ally.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffsDuration,
        context,
      });

      const evasionAmount =
        ally.Evasion > 0 ? ally.Evasion * this.evasionBuff : 10;

      ally.modifyStat({
        statName: "Evasion",
        amount: evasionAmount,
        duration: this.buffsDuration,
        context,
      });

      /* console.log("[BLYSKARTRI][condutancia_vital] buffs applied", {
        speedBuff: 10,
        evasionMultiplier: 3,
      });
      */

      ally.runtime.hookEffects ??= [];

      // Prevent hook stacking
      ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
        (h) => h.key !== "condutancia_vital_counter",
      );

      /* console.log("[BLYSKARTRI][condutancia_vital] hookEffects initialized", {
        hookEffects: ally.runtime.hookEffects,
      });
      */

      const piercingDamageBonus = this.piercingDamageBonus;

      ally.runtime.hookEffects.push({
        key: "condutancia_vital_counter",
        expiresAtTurn: context.currentTurn + this.buffsDuration,

        hookScope: {
          onEvade: "defender",
        },

        onEvade({ attacker, defender, owner, damage, context }) {
          // owner = aliado buffado
          console.log("[BLYSKARTRI][condutancia_vital] hook triggered", {
            owner: owner?.name,
            damage,
          });

          /* console.log(
            "[BLYSKARTRI][condutancia_vital] last damage event",
            damageEvent,
          ); */

          /*   console.log(
            "[BLYSKARTRI][condutancia_vital] source resolved",
            attacker?.name,
          ); */

          if (!attacker || !attacker.alive) return;

          const counterDamage = piercingDamageBonus;

          /*    console.log("[BLYSKARTRI][condutancia_vital] counter triggered", {
            attacker: attacker.name,
            damage: counterDamage,
          }); */

          new DamageEvent({
            baseDamage: counterDamage,
            mode: "piercing",
            piercingPercentage: 100,
            attacker: user,
            defender: attacker,
            skill: {
              key: "condutancia_vital_counter",
            },
            context,
            allChampions: context?.allChampions,
          }).execute();

          context.registerDialog({
            message: `${formatChampionName(user)} revidou o ataque de ${formatChampionName(attacker)} em seu aliado!`,
            sourceId: owner.id,
            targetId: attacker.id,
          });

          return {
            log: `${formatChampionName(user)} revidou o ataque de ${formatChampionName(attacker)} em seu aliado!`,
          };
        },
      });

      return {
        log: `${formatChampionName(user)} fortaleceu ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "horizonte_infinito",
    name: "Horizonte Infinito",
    damageMode: "standard",

    dmgBonus: 3, // Bônus de dano por velocidade (em %)
    speedPerStack: 10,

    piercingDamageBonus: 75,

    effectDuration: 2,
    priority: 4,

    contact: false,

    isUltimate: true,
    ultCost: 3,

    description() {
      return `Escolhe um aliado. Por ${this.effectDuration} turno(s), ele recebe +${this.dmgBonus}% de dano bruto para cada ${this.speedPerStack} de Velocidade total.  
      Sempre que o alvo direto NÃO agir antes do aliado, causa +${this.piercingDamageBonus} de dano perfurante adicional.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      const alreadyHasModifier = ally
        .getDamageModifiers()
        .some((mod) => mod.id === "horizonte_infinito");

      if (alreadyHasModifier) {
        return {
          log: `${formatChampionName(ally)} já está sob o efeito de Horizonte Infinito.`,
        };
      }

      ally.addDamageModifier({
        id: "horizonte_infinito",
        expiresAtTurn: context.currentTurn + this.effectDuration,
        apply: ({ baseDamage, attacker, defender }, eventContext = {}) => {
          // Bônus por velocidade
          const speed = attacker.Speed;
          const stacks = Math.floor(speed / this.speedPerStack);
          let resultDamage = baseDamage;
          if (stacks > 0) {
            const bonusPercent = stacks * this.dmgBonus;
            const bonusDamage = baseDamage * (bonusPercent / 100);
            resultDamage += bonusDamage;
          }

          // Bônus perfurante se agir antes do alvo direto
          // Busca o alvo direto (defender)
          // Busca context.executionIndex e context.turnExecutionMap
          const execIdx = eventContext.executionIndex ?? context.executionIndex;
          console.log(
            "[BLYSKARTRI][horizonte_infinito] damage modifier applied",
            {
              execIdx,
              attacker: attacker?.name,
              defender: defender?.name,
            },
          );

          const turnMap =
            eventContext.turnExecutionMap ?? context.turnExecutionMap;
          console.log("[BLYSKARTRI][horizonte_infinito] turn execution map", {
            turnMap,
          });

          const targetIdx = turnMap?.get(defender?.id);
          console.log(
            "[BLYSKARTRI][horizonte_infinito] target index vs attacker index",
            {
              targetIdx,
              execIdx,
            },
          );

          const actedBeforeTarget =
            execIdx !== undefined &&
            (targetIdx === undefined || execIdx < targetIdx);
          console.log("[BLYSKARTRI][horizonte_infinito] acted before target?", {
            actedBeforeTarget,
          });

          if (actedBeforeTarget) {
            // piercingDamageBonus definido na skill
            resultDamage += this.piercingDamageBonus || 0;
          }
          return resultDamage;
        },
      });

      return {
        log: `${formatChampionName(user)} abriu o Horizonte para ${formatChampionName(ally)}!`,
      };
    },
  },
];

export default blyskartriSkills;
