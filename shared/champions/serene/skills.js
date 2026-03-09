import { DamageEvent } from "../../engine/DamageEvent.js";
import { formatChampionName } from "../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const sereneSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
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
    priority: 1,
    description() {
      return `Causa dano ({perfurante}) igual a ${this.hpDamagePercent}% do HP máximo do alvo e deixa o alvo {atordoado} por ${this.stunDuration} turno(s).`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = Math.floor(enemy.maxHP * (this.hpDamagePercent / 100));

      // aplica status
      const stunned = enemy.applyStatusEffect(
        "atordoado",
        this.stunDuration,
        context,
      );

      // resolve dano
      const result = new DamageEvent({
        baseDamage,
        piercingPortion: baseDamage,
        mode: "hybrid",
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      // adiciona log da skill
      if (result?.log && stunned) {
        result.log += `\n${enemy.name} foi atordoado pela Quietude!`;
      } else if (stunned) {
        result.log = `${enemy.name} foi atordoado pela Quietude!`;
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

      console.log("══════════════════════════════════");
      console.log("[SERENE ULT] Epifania do Limiar ativada");
      console.log("[SERENE ULT] Usuária:", user.name);
      console.log("[SERENE ULT] Turno:", context.currentTurn);

      // dona do efeito é a Serene, mas o efeito é aplicado em tds aliados.
      const ownerId = user.id;

      const allies = context.aliveChampions.filter((c) => c.team === user.team);

      console.log(
        "[SERENE ULT] Aliados afetados:",
        allies.map((a) => a.name),
      );

      // 1️⃣ Proteção de Campo
      allies.forEach((ally) => {
        console.log("──────────────");
        console.log("[SERENE ULT] Aplicando proteção em:", ally.name);

        ally.applyDamageReduction({
          amount: this.damageReduction,
          duration: this.reductionDuration,
          source: "epifania",
          context,
        });

        console.log(
          `[SERENE ULT] ${ally.name} recebeu ${this.damageReduction}% redução por ${this.reductionDuration} turnos`,
        );

        ally.runtime.hookEffects ??= [];

        const surviveHP = this.surviveHP;

        const effect = {
          key: "epifania_limiar",
          group: "epifania",
          ownerId,

          onBeforeDmgTaking({ source, target, owner, damage, context }) {
            console.log("════════ EPIFANIA CHECK ════════");
            console.log("[EPIFANIA] Hook disparado");
            console.log("[EPIFANIA] Alvo:", self.name);
            console.log("[EPIFANIA] HP atual:", self.HP);
            console.log("[EPIFANIA] Dano recebido:", damage);
            console.log("[EPIFANIA] Atacante:", source?.name);

            if (target?.id !== owner.id) return;

            // Previne morte por qualquer meio (dano, efeitos, etc)
            self.runtime.preventObliterate = true;

            if (self.HP - damage > 0) {
              console.log("[EPIFANIA] Abortado → dano não é letal");
              return;
            }

            if (self.hasStatusEffect("imunidade_absoluta")) {
              console.log("[EPIFANIA] Abortado → já possui imunidade absoluta");
              return;
            }

            console.log("[EPIFANIA] DANO LETAL DETECTADO");

            const lockedHP = surviveHP;

            const adjustedDamage = Math.max(self.HP - lockedHP, 0);

            console.log("[EPIFANIA] HP final desejado:", lockedHP);
            console.log("[EPIFANIA] Dano ajustado:", adjustedDamage);

            self.applyStatusEffect("imunidade absoluta", 1, context, {
              source: "epifania",
            });

            console.log("[EPIFANIA] Imunidade absoluta aplicada em", self.name);

            context.visual.dialogEvents = context.visual.dialogEvents || [];
            context.visual.dialogEvents.push({
              type: "dialog",
              message: `${formatChampionName(self)} escapou da morte graças à Epifania do Limiar!`,
              sourceId: self.id,
              targetId: self.id,
              blocking: false,
            });

            return {
              damage: adjustedDamage,
              log: `${formatChampionName(self)} recusou a morte e tornou-se imune, permanecendo com ${lockedHP} de HP!`,
              effects: [
                {
                  type: "dialog",
                  message: `${formatChampionName(self)} recusou a morte e tornou-se imune!`,
                  blocking: true,
                },
              ],
            };
          },

          onActionResolved({ user, skill, context, self }) {
            console.log("════════ EPIFANIA CLEANUP ════════");
            console.log("[EPIFANIA] ActionResolved disparado");
            console.log("[EPIFANIA] Usuário da ação:", user?.name);
            console.log("[EPIFANIA] Skill:", skill?.key);
            if (user.id !== this.ownerId) {
              console.log("[EPIFANIA] Ignorado → ação não é da Serene");
              return;
            }
            // a ativação da própria skill não PODE remover o efeito
            if (skill?.key === activationSkillId) {
              console.log("[EPIFANIA] Ignorado → é a própria ult");
              return;
            }

            console.log("[EPIFANIA] Serene agiu → removendo proteção");

            // remove o efeito de todos os aliados
            context.aliveChampions.forEach((champ) => {
              if (champ.team !== user.team) return;
              console.log("[EPIFANIA] Removendo proteção de:", champ.name);

              champ.runtime.hookEffects = champ.runtime.hookEffects.filter(
                (e) => e.key !== "epifania_limiar",
              );

              console.log("[EPIFANIA] Efeito removido de", champ.name);

              champ.damageReductionModifiers = champ.damageReductionModifiers =
                champ.damageReductionModifiers.filter(
                  (mod) => mod.source !== "epifania",
                );
            });

            return {
              log: `${formatChampionName(user)} superou o Limiar da Existência e recuperou sua mortalidade...`,
            };
          },
        };
        // Remove quaisquer efeitos anteriores do mesmo grupo para evitar acúmulos indesejados
        ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
          (e) => e.group !== "epifania",
        );
        console.log("[SERENE ULT] Limpando efeitos anteriores de Epifania");

        ally.runtime.hookEffects.push(effect);
        console.log("[SERENE ULT] Hook registrado em", ally.name);
      });

      console.log("[SERENE ULT] Proteção aplicada a todos os aliados");
      console.log("══════════════════════════════════");
      return {
        log: `${formatChampionName(user)} alcança o Limiar da Existência.
        Aliados recebem proteção de campo!`,
      };
    },
  },
];

export default sereneSkills;
