import { DamageEvent } from "../../engine/DamageEvent.js";
import { formatChampionName } from "../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const blyskartriSkills = [
  basicAttack,
  {
    key: "fluxo_restaurador",
    name: "Fluxo Restaurador",
    speedBuff: 5,
    evasionBuff: 10,
    buffsDuration: 1,

    contact: false,
    priority: 3,

    description() {
      return `Concede +${this.speedBuff} Velocidade e +${this.evasionBuff} Esquiva por ${this.buffsDuration} turno(s). 
      Se o alvo já tiver bônus de Velocidade, ganha +1 barra de Ultômetro.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      console.log("[BLYSKARTRI][fluxo_restaurador] resolve", {
        caster: user?.name,
        ally: ally?.name,
        turn: context.currentTurn,
      });

      ally.modifyStat({
        statName: "Speed",
        amount: 5,
        duration: 1,
        context,
      });

      ally.modifyStat({
        statName: "Evasion",
        amount: 10,
        duration: 1,
        context,
      });

      console.log("[BLYSKARTRI][fluxo_restaurador] buffs applied", {
        speedBuff: 5,
        evasionBuff: 10,
      });

      if ((ally.runtime.speedBuffStacks || 0) > 0) {
        console.log(
          "[BLYSKARTRI][fluxo_restaurador] speed already buffed → granting ult",
        );
        ally.addUlt({ amount: 3, context });
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

    targetSpec: ["ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      console.log("[BLYSKARTRI][condutancia_vital] resolve", {
        caster: user?.name,
        ally: ally?.name,
        turn: context.currentTurn,
      });

      ally.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffsDuration,
        context,
      });

      const evasionAmount =
        ally.Evasion > 0 ? ally.Evasion * this.evasionBuff : 10;

      if (ally.evasionAmount === 0) {
        // conceder um pequeno bônus flat inicial
        ally.modifyStat({
          statName: "Evasion",
          amount: 10,
          duration: this.buffsDuration,
          context,
        });
      } else {
        ally.modifyStat({
          statName: "Evasion",
          amount: evasionAmount,
          duration: this.buffsDuration,
          context,
        });
      }

      console.log("[BLYSKARTRI][condutancia_vital] buffs applied", {
        speedBuff: 10,
        evasionMultiplier: 3,
      });

      ally.runtime.hookEffects ??= [];
      ally.runtime.hookEffects.push({
        key: "condutancia_vital_counter",
        expiresAtTurn: context.currentTurn + this.buffsDuration,

        onEvade({ dmgSrc, dmgReceiver, owner, damage, context }) {
          // owner = aliado buffado
          console.log("[BLYSKARTRI][condutancia_vital] hook triggered", {
            owner: owner?.name,
            damage,
          });

          const damageEvent = context.visual.damageEvents
            ?.filter((e) => e.targetId === owner.id)
            .at(-1);

          console.log(
            "[BLYSKARTRI][condutancia_vital] last damage event",
            damageEvent,
          );

          if (!damageEvent?.evaded) {
            console.log(
              "[BLYSKARTRI][condutancia_vital] no evade → no counter",
            );
            return;
          }

          const attacker =
            context?.allChampions?.get?.(damageEvent.sourceId) ??
            context?.allChampions?.find?.((c) => c.id === damageEvent.sourceId);

          console.log(
            "[BLYSKARTRI][condutancia_vital] attacker resolved",
            attacker?.name,
          );

          if (!attacker || !attacker.alive) return;

          const counterDamage = 60;
          console.log("[BLYSKARTRI][condutancia_vital] counter triggered", {
            attacker: attacker.name,
            damage: counterDamage,
          });

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "hybrid",
            baseDamage: counterDamage,
            piercingPortion: counterDamage,
            user: user, // Blyskartri é quem causa o dano
            source: user,
            target: attacker,
            skill: {
              key: "condutancia_vital_counter",
            },
          });

          context.visual.dialogEvents ??= [];
          context.visual.dialogEvents.push({
            type: "dialog",
            message: `${formatChampionName(owner)} conduziu energia elétrica de Blyskartri!`,
            sourceId: owner.id,
            targetId: attacker.id,
            blocking: false,
          });
        },
      });

      const enemies = context.allChampions.filter(
        (c) => c.team !== user.team && c.HP > 0,
      );

      console.log(
        "[BLYSKARTRI][condutancia_vital] resolving damage to highest ATK enemy",
        {
          enemies: enemies.map((e) => ({
            name: e.name,
            Attack: e.Attack,
          })),
        },
      );

      const highestAtk = enemies.reduce((a, b) =>
        a.Attack > b.Attack ? a : b,
      );
      console.log("[BLYSKARTRI][condutancia_vital] highest ATK enemy", {
        name: highestAtk.name,
        Attack: highestAtk.Attack,
      });

      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        user,
        target: highestAtk,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  /*   {
    key: "blyskartri_hab_2",
    name: "Blyskartri-Hab-2",
    bf: 60,
    damageMode: "standard",
    speedBuff: 10,
    evasionBuff: 2,
    buffsDuration: 2,

    contact: false,
    description() {
      return `Concede ${this.speedBuff} e aumenta a Esquiva em ${this.evasionBuff}x (ou concede +5 caso não possua Esquiva) por ${this.buffsDuration} turnos.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.buffsDuration,
        context,
      });

      if (baseEvasion > 0) {
        // 3x usando percentual da base
        ally.modifyStat({
          statName: "Evasion",
          amount: (this.evasionBuff - 1) * 100,
          duration: this.buffsDuration,
          context,
          isPercent: true,
        });
      } else {
        // conceder pequeno bônus flat inicial
        ally.modifyStat({
          statName: "Evasion",
          amount: 10,
          duration: this.buffsDuration,
          context,
        });
      }

      // Removido: addResource mana

      return {
        log: `${formatChampionName(user)} concedeu buffs para ${formatChampionName(ally)}.`,
      };
    },
  }, */

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
      return `Escolhe um aliado. Por ${this.effectDuration} turnos completos, ele recebe +${this.dmgBonusPerStack}% de dano bruto para cada ${this.speedPerStack} de Velocidade acima da base.  
      Sempre que agir antes do alvo direto, causa +${this.piercingDamageBonus} de dano {perfurante} adicional.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;
      console.log("[BLYSKARTRI][horizonte_infinito] resolve", {
        caster: user?.name,
        ally: ally?.name,
        turn: context.currentTurn,
      });

      ally.addDamageModifier({
        id: "horizonte_infinito",

        expiresAtTurn: context.currentTurn + this.effectDuration,

        apply: ({ baseDamage, user }) => {
          const bonusSpeed = Math.max(0, user.Speed - user.baseSpeed);

          const stacks = Math.floor(bonusSpeed / 5);
          console.log("[BLYSKARTRI][horizonte_infinito] damage modifier", {
            user: user.name,
            baseDamage,
            bonusSpeed,
            stacks,
          });

          if (stacks <= 0) return baseDamage;

          const bonusPercent = stacks * 3;

          const bonusDamage = Math.floor(baseDamage * (bonusPercent / 100));
          console.log("[BLYSKARTRI][horizonte_infinito] bonus applied", {
            bonusPercent,
            bonusDamage,
          });

          return baseDamage + bonusDamage;
        },
      });

      ally.runtime.hookEffects ??= [];

      ally.runtime.hookEffects.push({
        key: "horizonte_infinito",

        expiresAtTurn: context.currentTurn + this.effectDuration,

        onAfterDmgDealing({ owner, dmgSrc, dmgReceiver, damage, context }) {
          console.log("[BLYSKARTRI][horizonte_infinito] after damage hook", {
            attacker: owner?.name,
            target: dmgReceiver?.name,
            damage,
          });
          if (!dmgReceiver?.alive) return;
          const currentIndex = context.currentAction?.initiativeIndex;

          const targetAction = context.turnActions?.find(
            (a) => a.championId === dmgReceiver.id,
          );
          console.log("[BLYSKARTRI][horizonte_infinito] initiative check", {
            currentIndex,
            targetIndex: targetAction?.initiativeIndex,
          });

          if (!targetAction) return;

          if (currentIndex >= targetAction.initiativeIndex) {
            console.log(
              "[BLYSKARTRI][horizonte_infinito] acted after target → no bonus",
            );
            return;
          }
          console.log(
            "[BLYSKARTRI][horizonte_infinito] bonus damage triggered",
          );

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            mode: "hybrid",
            baseDamage: this.piercingDamageBonus,
            piercingPortion: this.piercingDamageBonus,
            user: owner,
            source: owner,
            target: dmgReceiver,
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
