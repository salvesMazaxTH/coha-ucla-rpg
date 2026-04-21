import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const sereneSkills = [
  // ========================
  // Disparo Básico (global)
  // ========================
  basicShot,
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
      user.runtime.sereneStreak ??= 0;
      user.runtime.lastSereneSkillTurn ??= null;

      // streak: conta usos consecutivos
      if (user.runtime.lastSereneSkillTurn === context.currentTurn - 1) {
        user.runtime.sereneStreak += 1;
      } else {
        user.runtime.sereneStreak = 1;
      }
      user.runtime.lastSereneSkillTurn = context.currentTurn;

      const baseDamage = enemy.maxHP * (this.hpDamagePercent / 100);
      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Stun logic
      let stunSuccess = true;
      if (user.runtime.sereneStreak > 1) {
        // 50% chance a partir do segundo uso consecutivo
        stunSuccess = Math.random() < 0.5;
      }

      if (!result?.evaded && !result?.immune && stunSuccess) {
        const stunned = enemy.applyStatusEffect(
          "stunned",
          this.stunDuration,
          context,
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
      }

      return result;
    },
  },

  {
    key: "epifania_do_limiar",
    name: "Epifania do Limiar",
    damageReduction: 30,
    reductionDuration: 2,
    surviveHP: 75,
    contact: false,

    isUltimate: true,
    ultCost: 2,

    priority: 4,
    description() {
      return `Aliados recebem redução de dano de ${this.damageReduction} por ${this.reductionDuration} turnos. Se receberem dano letal, sobrevivem com ${this.surviveHP} de HP e recebem imunidade absoluta até a próxima ação de Serene (quaisquer tipos de execuções são impedidas).`;
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      const activationSkillId = this.key;

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

            owner.runtime.preventObliterate = true;

            if (owner.HP - damage > 0) {
              // console.log("[EPIFANIA] Abortado → dano não é letal");
              return;
            }

            if (owner.hasStatusEffect("absoluteImmunity")) {
              // console.log("[EPIFANIA] Abortado → já possui imunidade absoluta");
              return;
            }

            // console.log("[EPIFANIA] DANO LETAL DETECTADO");

            const lockedHP = surviveHP;

            const adjustedDamage = Math.max(owner.HP - lockedHP, 0);

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

          onActionResolved({ actionSource, skill, context }) {
            // console.log("════════ EPIFANIA CLEANUP ════════");
            // console.log("[EPIFANIA] ActionResolved disparado");
            // console.log("[EPIFANIA] Usuário da ação:", actionSource?.name);
            // console.log("[EPIFANIA] Skill:", skill?.key);

            if (actionSource.id !== ownerId) {
              // console.log("[EPIFANIA] Ignorado → ação não é da Serene");
              return;
            }

            if (skill?.key === activationSkillId) {
              // console.log("[EPIFANIA] Ignorado → é a própria ult");
              return;
            }

            // console.log("[EPIFANIA] Serene agiu → removendo proteção");

            context.aliveChampions.forEach((champ) => {
              if (champ.team !== actionSource.team) return;

              // console.log("[EPIFANIA] Removendo proteção de:", champ.name);

              champ.runtime.hookEffects = champ.runtime.hookEffects.filter(
                (e) => e.key !== "epifania_limiar",
              );

              champ.damageReductionModifiers =
                champ.damageReductionModifiers.filter(
                  (mod) => mod.source !== "epifania",
                );

              // console.log("[EPIFANIA] Efeito removido de", champ.name);
            });

            return {
              log: `${formatChampionName(actionSource)} superou o Limiar da Existência e recuperou sua mortalidade...`,
            };
          },
        };

        ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
          (e) => e.group !== "epifania",
        );

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
