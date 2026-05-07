import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const sereneSkills = [
  // ========================
  // Disparo Básico (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "voto_harmonico",
    name: "Voto Harmônico",
    shieldFull: 60,
    shieldReduced: 35,
    hpThreshold: 65,
    contact: false,

    priority: 2,
    description() {
      return `Concede ${this.shieldFull} de escudo a si mesma ou a um aliado. Se estiver abaixo de ${this.hpThreshold}% do HP máximo, concede ${this.shieldReduced}.`;
    },
    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      let shieldAmount = this.shieldFull;

      if (user.HP < user.maxHP * (this.hpThreshold / 100)) {
        shieldAmount = this.shieldReduced;
      }

      ally.addShield(shieldAmount, 0, context);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} concedeu ${shieldAmount} de escudo a ${
          userName === allyName ? "si mesmo" : allyName
        }.`,
      };
    },
  },

  {
    key: "selo_da_quietude",
    name: "Selo da Quietude",
    hpDamagePercent: 15,
    stunDuration: 1,
    contact: false,
    damageMode: "piercing",
    piercingPercentage: 100,
    priority: 1, // buff: prio +1
    description() {
      return `Causa dano perfurante (${this.piercingPercentage}% de perfuração) igual a ${this.hpDamagePercent}% do HP máximo do alvo e deixa o alvo {atordoado} por ${this.stunDuration} turno(s). Se usada consecutivamente, a partir do segundo uso, a chance de atordoar é 50%.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      user.runtime ??= {};
      const previousSkillKey = user.runtime.lastSereneSkillKey ?? null;
      user.runtime.sereneStreak ??= 0;

      console.debug(
        `[Serene:selo_da_quietude] START turn=${context.currentTurn} execIdx=${context.executionIndex ?? "N/A"} user=${user.name} target=${enemy?.name} prevSkill=${previousSkillKey} prevStreak=${user.runtime.sereneStreak}`,
      );

      // streak: conta usos consecutivos da própria skill da Serene
      const isConsecutiveQuietudeUse = previousSkillKey === this.key;
      if (isConsecutiveQuietudeUse) {
        user.runtime.sereneStreak += 1;
      } else {
        user.runtime.sereneStreak = 1;
      }

      console.debug(
        `[Serene:selo_da_quietude] STREAK turn=${context.currentTurn} consecutiveBySkill=${isConsecutiveQuietudeUse} streakNow=${user.runtime.sereneStreak}`,
      );

      const baseDamage = enemy.maxHP * (this.hpDamagePercent / 100);
      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Stun logic
      let stunSuccess = true;
      let stunRoll = null;
      if (user.runtime.sereneStreak > 1) {
        // 50% chance a partir do segundo uso consecutivo
        stunRoll = Math.random();
        stunSuccess = stunRoll < 0.5;
      }

      console.debug(
        `[Serene:selo_da_quietude] STUN_CHECK streak=${user.runtime.sereneStreak} roll=${stunRoll ?? "N/A"} success=${stunSuccess} evaded=${Boolean(result?.evaded)} immune=${Boolean(result?.immune)}`,
      );

      if (!result?.evaded && !result?.immune && stunSuccess) {
        const stunned = enemy.applyStatusEffect(
          "stunned",
          this.stunDuration,
          context,
        );
        console.debug(
          `[Serene:selo_da_quietude] APPLY_STUN attempted=true applied=${Boolean(stunned)} target=${enemy?.name}`,
        );
        if (stunned && stunned.log && result?.log) {
          result.log += `\n${formatChampionName(enemy)} foi atordoado pela Quietude!`;
        } else if (stunned && stunned.log) {
          result.log = `${formatChampionName(enemy)} foi atordoado pela Quietude!`;
        }
      } else if (
        user.runtime.sereneStreak > 1 &&
        !result?.evaded &&
        !result?.immune
      ) {
        // Falhou o stun por chance
        result.log =
          (result.log || "") +
          `\n${formatChampionName(enemy)} resistiu ao atordoamento!`;
        console.debug(
          `[Serene:selo_da_quietude] APPLY_STUN attempted=true applied=false reason=roll_failed target=${enemy?.name}`,
        );
      }

      console.debug(
        `[Serene:selo_da_quietude] END turn=${context.currentTurn} streak=${user.runtime.sereneStreak} resultLogPresent=${Boolean(result?.log)}`,
      );

      return result;
    },
  },

  {
    key: "epifania_do_limiar",
    name: "Epifania do Limiar",

    damageReduction: 30,
    reductionDuration: 2,
    surviveHP: 75,
    auraDuration: 2,
    immunityDuration: 1,

    contact: false,

    isUltimate: true,
    ultCost: 4,

    priority: 4,

    description() {
      return `Serene atinge o Limiar da Existência, concedendo a si mesma e aos aliados ${this.damageReduction}% de redução de dano por ${this.reductionDuration} turnos.

      Enquanto a aura persistir (${this.auraDuration} turnos), o primeiro aliado que sofreria dano letal, em vez disso, sobrevive com ${this.surviveHP} de HP, torna-se imune por ${this.immunityDuration} turno e consome a aura, dissipando-a para todos os aliados.`;
    },

    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      // console.log("══════════════════════════════════");
      // console.log("[SERENE ULT] Epifania do Limiar ativada");
      // console.log("[SERENE ULT] Usuária:", user.name);
      // console.log("[SERENE ULT] Turno:", context.currentTurn);

      const ownerId = user.id;

      const allies = context.aliveChampions.filter((c) => c.team === user.team);

      /* console.log(
        "[SERENE ULT] Aliados afetados:",
        allies.map((a) => a.name),
      );
      */

      const alreadyActive = allies.some((c) =>
        c.runtime.hookEffects?.some((e) => e.key === "epifania_limiar"),
      );

      if (alreadyActive) {
        return {
          log: `${formatChampionName(user)} tentou invocar o Limiar, mas ele já está ativo...`,
        };
      }

      allies.forEach((ally) => {
        // console.log("──────────────");
        // console.log("[SERENE ULT] Aplicando proteção em:", ally.name);

        ally.applyDamageReduction({
          amount: this.damageReduction,
          duration: this.reductionDuration,
          source: "epifania",
          context,
        });

        /* console.log(
          `[SERENE ULT] ${ally.name} recebeu ${this.damageReduction}% redução por ${this.reductionDuration} turnos`,
        );
        */
        ally.runtime.hookEffects ??= [];

        const surviveHP = this.surviveHP;

        const effect = {
          key: "epifania_limiar",
          group: "epifania",
          ownerId,
          expiresAtTurn: context.currentTurn + this.auraDuration,

          hookScope: {
            onBeforeDmgTaking: "defender",
          },

          onBeforeDmgTaking({ attacker, defender, owner, damage, context }) {
            // console.log("════════ EPIFANIA CHECK ════════");
            // console.log("[EPIFANIA] Hook disparado");
            // console.log("[EPIFANIA] Alvo:", owner.name);
            // console.log("[EPIFANIA] HP atual:", owner.HP);
            // console.log("[EPIFANIA] Dano recebido:", damage);
            // console.log("[EPIFANIA] Atacante:", attacker?.name);

            if (!defender || defender.id !== owner.id || defender !== owner)
              return;

            if (owner.HP - damage > 0) {
              // console.log("[EPIFANIA] Abortado → dano não é letal");
              return;
            }

            owner.runtime.preventFinishing = true;

            if (owner.hasStatusEffect("absoluteImmunity")) {
              // console.log("[EPIFANIA] Abortado → já possui imunidade absoluta");
              return;
            }

            // console.log("[EPIFANIA] DANO LETAL DETECTADO");

            const lockedHP = surviveHP;

            const adjustedDamage = Math.max(owner.HP - lockedHP, 0);

            // FORÇA O HP FINAL
            owner.HP = Math.max(owner.HP - adjustedDamage, lockedHP);

            // console.log("[EPIFANIA] HP final desejado:", lockedHP);
            // console.log("[EPIFANIA] Dano ajustado:", adjustedDamage);

            owner.applyStatusEffect("absoluteImmunity", 1, context, {
              source: "epifania",
            });

            /* console.log(
              "[EPIFANIA] Imunidade absoluta aplicada em",
              owner.name,
            );
            */

            const allies = context.aliveChampions.filter(
              (c) => c.team === owner.team,
            );

            for (const champ of allies) {
              champ.runtime.hookEffects = champ.runtime.hookEffects.filter(
                (e) => e.key !== "epifania_limiar",
              );
              delete champ.runtime.preventFinishing;
            }

            context.registerDialog({
              message: `${formatChampionName(owner)} escapou da morte graças à Epifania do Limiar!`,
              sourceId: owner.id,
              targetId: owner.id,
            });

            return {
              damage: adjustedDamage,
              log: `${formatChampionName(owner)} recusou a morte e tornou-se imune, permanecendo com ${lockedHP} de HP!`,
            };
          },
        };

        // console.log("[SERENE ULT] Limpando efeitos anteriores de Epifania");

        ally.runtime.hookEffects.push(effect);

        // console.log("[SERENE ULT] Hook registrado em", ally.name);
      });

      // console.log("[SERENE ULT] Proteção aplicada a todos os aliados");
      // console.log("══════════════════════════════════");

      return {
        log: `${formatChampionName(user)} alcança o Limiar da Existência.
        Aliados recebem proteção de campo!`,
      };
    },
  },
];

export default sereneSkills;
