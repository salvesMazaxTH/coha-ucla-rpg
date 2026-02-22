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
    manaCost: 20,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
        Serene concede ${this.shieldFull} de escudo a si mesma ou a um aliado ativo. Caso ela esteja abaixo de ${this.hpThreshold}% do HP máximo, o valor do escudo concedido cai para ${this.shieldReduced}.

        Escudo:
        - Mínimo: ${this.shieldReduced}`;
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
    manaCost: 26,
    priority: 1,
    description() {
      return `Custo: ${this.manaCost} MP
      Prioridade: +${this.priority}
      Contato: ${this.contact ? "✅" : "❌"}
      Dano:
      ${this.hpDamagePercent}% do HP máximo do alvo como Dano Direto (NÃO sofre redução pela Defesa).`;
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
      const result = CombatResolver.resolveDamage({
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
    manaCost: 35,
    priority: 4,
    description() {
      return `Custo: ${this.manaCost} MP
        Prioridade: +${this.priority}
        Ao ativar, até que a próxima ação de Serene seja resolvida:
        1️⃣ Proteção de Campo
        Aliados ativos recebem:
        −${this.damageReduction} de dano de todas as fontes (respeita o piso mínimo de 10)
        2️⃣ Limiar da Existência (Auto-Resgate)
        Se o HP do personagem cairia a 0 ou menos, em vez disso:
        Ele permanece com ${this.surviveHP} de HP travados (se não estivesse com menos de ${this.surviveHP} de HP)
        A partir desse momento, o personagem ganha:
        'Imunidade Absoluta': o personagem não pode receber dano ou efeitos negativos de nenhuma fonte até que sua próxima ação seja resolvida.`;
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

          beforeDamageTaken({ dmgSrc, dmgReceiver, self, damage, context }) {
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

            const lockedHP = self.HP >= surviveHP ? surviveHP : self.HP;

            self.HP = lockedHP;

            self.applyKeyword("imunidade_absoluta", 1, context, {
              source: "epifania",
            });

            return {
              damage: 0,
              ignoreMinimumFloor: true,
              log: `${formatChampionName(self)} recusou a morte e tornou-se imune, permanecendo com ${lockedHP} de HP!`,
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
        ally.runtime.hookEffects = ally.runtime.hookEffects.filter((e) => e.group !== "epifania");

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
