import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
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
    manaCost: 50,
    priority: 0,
    description() {
      return `Concede ${this.shieldFull} de escudo a si mesma ou a um aliado. Se estiver abaixo de ${this.hpThreshold}% do HP máximo, concede ${this.shieldReduced}.`;
    },
    targetSpec: ["select:ally"],

    execute({ user, targets, context = {} }) {
      const { ally } = targets;

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
    manaCost: 150,
    priority: 1,
    description() {
      return `Causa dano direto igual a ${this.hpDamagePercent}% do HP máximo do alvo e atordoa por ${this.stunDuration} turno(s).`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;

      const baseDamage = Math.floor(enemy.maxHP * (this.hpDamagePercent / 100));

      // aplica status
      const stunned = enemy.applyKeyword(
        "atordoado",
        this.stunDuration,
        context,
      );

      // resolve dano
      const result = CombatResolver.processDamageEvent({
        mode: "hybrid",
        baseDamage,
        direct: baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

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
    surviveHP: 50,
    contact: false,
    manaCost: 400,
    priority: 4,
    description() {
      return `Aliados recebem redução de dano de ${this.damageReduction} por ${this.reductionDuration} turnos. Se receberem dano letal, sobrevivem com pelo menos ${this.surviveHP} de HP e tornam-se imunes até a próxima ação de Serene.`;
    },
    targetSpec: ["self"],
    execute({ user, context = {} }) {
      const activationSkillId = this.key;

      // dona do efeito é a Serene, mas o efeito é aplicado em tds aliados.
      const ownerId = user.id;

      const allies = context.aliveChampions.filter((c) => c.team === user.team);

      // 1️⃣ Proteção de Campo
      allies.forEach((ally) => {
        ally.applyDamageReduction({
          amount: this.damageReduction,
          duration: this.reductionDuration,
          source: "epifania",
          context,
        });

        ally.runtime.hookEffects ??= [];

        const surviveHP = this.surviveHP;

        const effect = {
          key: "epifania_limiar",
          group: "epifania",
          ownerId,

          onBeforeDmgTaking({ dmgSrc, dmgReceiver, self, damage, context }) {
            console.log("HOOK DE ANTES DE TOMAR DANO DA EPIFANIA DISPAROU!!");

            console.log("Damage recebido:", {
              dmgSrc,
              dmgReceiver,
              self,
              damage,
            });

            if (dmgReceiver?.id !== self.id) return;
            if (self.HP - damage > 0) return;
            if (self.hasKeyword("imunidade_absoluta")) return;

            const lockedHP = Math.max(self.HP, surviveHP);

            const adjustedDamage = Math.max(0, self.HP - lockedHP);

            self.applyKeyword("imunidade_absoluta", 1, context, {
              source: "epifania",
            });

            return {
              damage: adjustedDamage,
              ignoreMinimumFloor: true,
              log: `${formatChampionName(self)} recusou a morte e tornou-se imune, permanecendo com ${lockedHP} de HP!`,
              effects: [
                {
                  type: "dialog",
                  message: `${formatChampionName(self)} recusou a morte e tornou-se imune!`,
                  blocking: true,
                  html: true,
                },
              ],
            };
          },

          onActionResolved({ user, skill, context, self }) {
            if (user.id !== this.ownerId) return;
            // a ativação da própria skill não PODE remover o efeito
            if (skill?.key === activationSkillId) {
              return;
            }

            // remove o efeito de todos os aliados
            context.aliveChampions.forEach((champ) => {
              if (champ.team !== user.team) return;
              champ.runtime.hookEffects = champ.runtime.hookEffects.filter(
                (e) => e.key !== "epifania_limiar",
              );

              champ.damageReductionModifiers =
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

        ally.runtime.hookEffects.push(effect);
      });

      return {
        log: `${formatChampionName(user)} alcança o Limiar da Existência.
        Aliados recebem proteção de campo!`,
      };
    },
  },
];

export default sereneSkills;
