import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const blyskartriSkills = [
  basicAttack,
  {
    key: "fluxo_amplificador",
    name: "Fluxo Amplificador",
    speedBuff: 5,
    evasionBuff: 10,
    buffsDuration: 2,

    contact: false,
    priority: 3,

    description() {
      return `Concede +${this.speedBuff} Velocidade e +${this.evasionBuff} Esquiva por ${this.buffsDuration} turno(s). 
      Se o alvo já tiver bônus de Velocidade, ganha +1 barra de Ultômetro.`;
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

      if ((ally.runtime.speedBuffStacks || 0) > 0) {
        /* console.log(
          "[BLYSKARTRI][fluxo_restaurador] speed already buffed â†’ granting ult",
        );
        */
        ally.addUlt({ amount: 4, context });
      }

      return {
        log: `${formatChampionName(user)} energizou ${formatChampionName(ally)}.`,
      };
    },
  },

  {
    key: "condutancia_vital",

    name: "Condutância Vital",

    bf: 60,

    damageMode: "standard",

    piercingDamageBonus: 60,

    priority: 1,

    speedBuff: 10,
    evasionBuff: 2,
    buffsDuration: 2,

    contact: false,

    description() {
      return `Concede ${this.speedBuff} Velocidade e triplica a Esquiva por ${this.buffsDuration} turnos.
      Durante este turno, sempre que o alvo Esquivar, causa ${this.piercingDamageBonus} de dano perfurante no agressor.
      Também causa dano ao inimigo com maior Ataque.`;
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

      /* console.log("[BLYSKARTRI][condutancia_vital] hookEffects initialized", {
        hookEffects: ally.runtime.hookEffects,
      });
      */

      ally.runtime.hookEffects.push({
        key: "condutancia_vital_counter",
        expiresAtTurn: context.currentTurn + this.buffsDuration,

        onEvade({ source, target, owner, damage, context }) {
          // owner = aliado buffado
          /* console.log("[BLYSKARTRI][condutancia_vital] hook triggered", {
            owner: owner?.name,
            damage,
          });
          */

          const damageEvent = context.visual.damageEvents
            ?.filter((e) => e.targetId === owner.id)
            .at(-1);

          /* console.log(
            "[BLYSKARTRI][condutancia_vital] last damage event",
            damageEvent,
          );
          */
          if (!damageEvent?.evaded) {
            /* console.log(
              "[BLYSKARTRI][condutancia_vital] no evade â†’ no counter",
            );
            */
            return;
          }

          /* console.log(
            "[BLYSKARTRI][condutancia_vital] source resolved",
            source?.name,
          );
          */
          if (!source || !source.alive) return;

          const counterDamage = 60;
          /* console.log("[BLYSKARTRI][condutancia_vital] counter triggered", {
            attacker: source.name,
            damage: counterDamage,
          });
          */

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "hybrid",
            baseDamage: counterDamage,
            piercingPortion: counterDamage,
            attacker: user, // Blyskartri Ã© quem causa o dano
            defender: source,
            skill: {
              key: "condutancia_vital_counter",
            },
          });

          context.visual.dialogEvents ??= [];
          context.visual.dialogEvents.push({
            type: "dialog",
            message: `${formatChampionName(user)} Blyskartri revidou o ataque de ${formatChampionName(source)} em seu aliado!`,
            sourceId: owner.id,
            targetId: source.id,
            blocking: false,
          });
        },
      });

      const enemies = Array.from(context.allChampions.values()).filter(
        (c) => c.team !== user.team && c.HP > 0,
      );

      /* console.log(
        "[BLYSKARTRI][condutancia_vital] resolving damage to highest ATK enemy",
        {
          enemies: enemies.map((e) => ({
            name: e.name,
            Attack: e.Attack,
          })),
        },
      );
      */
      const highestAtk = enemies.reduce((a, b) =>
        a.Attack > b.Attack ? a : b,
      );
      /* console.log("[BLYSKARTRI][condutancia_vital] highest ATK enemy", {
        name: highestAtk.name,
        Attack: highestAtk.Attack,
      });
      */

      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: highestAtk,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "horizonte_infinito",
    name: "Horizonte Infinito",
    damageMode: "standard",

    dmgBonusPerStack: 3,
    speedPerStack: 5,

    piercingDamageBonus: 75,

    effectDuration: 2,
    priority: 4,

    contact: false,

    isUltimate: true,
    ultCost: 3,

    description() {
      return `Escolhe um aliado. Por ${this.effectDuration} turno(s), ele recebe +${this.dmgBonusPerStack}% de dano bruto para cada ${this.speedPerStack} de Velocidade acima da base.  
      Sempre que agir antes do alvo direto, causa +${this.piercingDamageBonus} de dano {perfurante} adicional.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;
      /* console.log("[BLYSKARTRI][horizonte_infinito] resolve", {
        caster: user?.name,
        ally: ally?.name,
        turn: context.currentTurn,
      });
      */

      ally.addDamageModifier({
        id: "horizonte_infinito",

        expiresAtTurn: context.currentTurn + this.effectDuration,

        apply: ({ baseDamage, source }) => {
          const bonusSpeed = Math.max(0, source.Speed - source.baseSpeed);

          const stacks = Math.floor(bonusSpeed / 5);
          /* console.log("[BLYSKARTRI][horizonte_infinito] damage modifier", {
            user: source.name,
            baseDamage,
            bonusSpeed,
            stacks,
          });
          */

          if (stacks <= 0) return baseDamage;

          const bonusPercent = stacks * 3;

          const bonusDamage = Math.floor(baseDamage * (bonusPercent / 100));
          /* console.log("[BLYSKARTRI][horizonte_infinito] bonus applied", {
            bonusPercent,
            bonusDamage,
          });
          */

          return baseDamage + bonusDamage;
        },
      });

      ally.runtime.hookEffects ??= [];

      ally.runtime.hookEffects.push({
        key: "horizonte_infinito",

        expiresAtTurn: context.currentTurn + this.effectDuration,

        onAfterDmgDealing({ owner, source, target, damage, context }) {
          /* console.log("[BLYSKARTRI][horizonte_infinito] after damage hook", {
            attacker: owner?.name,
            target: target?.name,
            damage,
          });
          */
          if (!target?.alive) return;
          const currentIndex = context.currentAction?.initiativeIndex;

          const targetAction = context.turnActions?.find(
            (a) => a.championId === target.id,
          );
          /* console.log("[BLYSKARTRI][horizonte_infinito] initiative check", {
            currentIndex,
            targetIndex: targetAction?.initiativeIndex,
          });
          */

          if (!targetAction) return;

          if (currentIndex >= targetAction.initiativeIndex) {
            /* console.log(
              "[BLYSKARTRI][horizonte_infinito] acted after target â†’ no bonus",
            );
            */
            return;
          }
          /* console.log(
            "[BLYSKARTRI][horizonte_infinito] bonus damage triggered",
          );
          */
          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "hybrid",
            baseDamage: this.piercingDamageBonus,
            piercingPortion: this.piercingDamageBonus,
            attacker: owner,
            source: owner,
            target,
            skill: {
              key: "horizonte_infinito_bonus",
            },
          });
        },
      });

      return {
        log: `${formatChampionName(user)} abriu o Horizonte para ${formatChampionName(ally)}!`,
      };
    },
  },
];

export default blyskartriSkills;
