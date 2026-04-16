import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const naelthosSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "toque_da_mare_serena",
    name: "Toque da Maré Serena",
    bf: 75,
    healAmount: 45,
    damageMode: "standard",
    contact: false,

    priority: 0,
    element: "water",
    description() {
      return `Naelthos causa dano ao inimigo e cura o aliado mais ferido em ${this.healAmount} HP.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const healAmount = this.healAmount;

      const results = [];

      // 🗡️ Dano no inimigo (se ainda vivo)
      if (enemy) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        results.push(damageResult);
      }
      let allyLog = "";
      let statLog = "";

      const moreInjuredAlly = context.aliveChampions
        .filter((champ) => champ.team === user.team)
        .sort((a, b) => a.HP / a.maxHP - b.HP / b.maxHP)[0];
      const ally = moreInjuredAlly || null;

      // 💧 Cura no aliado (se existir)
      if (ally) {
        ally.heal(healAmount, context, user);
        const userName = formatChampionName(user);
        const allyName = formatChampionName(ally);
        allyLog = `${userName} cura ${allyName} em ${healAmount} de HP. HP final de ${allyName}: ${ally.HP}/${ally.maxHP}`;
      } else {
        const userName = formatChampionName(user);
        allyLog = `${userName} tenta curar um aliado, mas nenhum está disponível.`;
      }

      results.push({
        log: `${allyLog} ${statLog}`,
      });

      return results;
    },
  },

  {
    key: "forma_aquatica",
    name: "Forma Aquática",
    effectDuration: 2,
    contact: false,

    priority: 2,
    element: "water",
    description() {
      return `Transforma-se em água pura, ficando inalvejável por ${this.effectDuration} turnos. Pode ser interrompido se executar uma ação ou se for alvejado por uma habilidade de raio (nesse caso, o dano é reduzido pela metade).`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const { currentTurn } = context;

      user.runtime.hookEffects ??= [];

      const hookEffect = {
        key: "forma_aquatica_hook",
        group: "skill",
        form: "bola_agua",
        expiresAtTurn: currentTurn + this.effectDuration,
        hookScope: {
          onDamageIncoming: "defender",
          onStatusEffectIncoming: "target",
          onActionResolved: "actionSource",
        },
        onTurnStart({ owner, context }) {
          if (context.currentTurn < this.expiresAtTurn) return;
          owner.runtime.form = null;
        },
        onActionResolved({ actionSource, owner, skill }) {
          if (actionSource !== owner) return;
          if (skill?.key === "forma_aquatica") return;
          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (e) => e.key !== "forma_aquatica_hook",
          );
          owner.runtime.form = null;
        },
        onDamageIncoming({ defender, damage, skill }) {
          if (skill?.element === "lightning") {
            defender.runtime.hookEffects = defender.runtime.hookEffects.filter(
              (e) => e.key !== "forma_aquatica_hook",
            );
            defender.runtime.form = null;
            return {
              cancel: false,
              immune: false,
              modifiedDamage: damage / 2,
            };
          }
          return {
            cancel: true,
            immune: true,
            message: `${formatChampionName(defender)} está em Forma Aquática! É inalvejável e imune a dano!`,
          };
        },
        onStatusEffectIncoming({ target, statusEffect }) {
          if (statusEffect.type !== "debuff") return;
          return {
            cancel: true,
            immune: true,
            message: `${formatChampionName(target)} está em Forma Aquática! É inalvejável e imune a efeitos negativos!`,
          };
        },
      };

      user.runtime.hookEffects.push(hookEffect);
      user.runtime.form = "bola_agua"; // Para animação visual

      // Apply inerte como status effect (interrompível por ação)
      /*       user.applyStatusEffect("inerte", this.effectDuration, context, {
        canBeInterruptedByAction: true,
      });
 */
      const userName = formatChampionName(user);
      return [
        {
          log: `${userName} usa Forma Aquática! Está inalvejável até o turno ${currentTurn + this.effectDuration}. (Pode ser interrompido por ação do usuário).`,
        },
      ];
    },
  },

  {
    key: "transbordar_do_mar_primordial",
    name: "Transbordar do Mar Primordial",
    hpFactor: 55,
    healAmount: 50,
    effectDuration: 3,
    hpPerStack: 30,
    bonusPerStack: 20,
    maxBonus: 500,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    ultCost: 3,

    element: "water",

    priority: 0,
    description() {
      return `Aumenta HP máximo em ${this.hpFactor}% do HP base, cura ${this.healAmount} HP e ativa o efeito Mar em Ascensão: ataques recebem bônus de dano (+${this.bonusPerStack} para cada ${this.hpPerStack} de HP atual, até ${this.maxBonus}) por ${this.effectDuration} turnos.`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const { currentTurn } = context;
      // console.log("ULT EXECUTADA:", user.name, "TURNO:", currentTurn);

      const factor = this.hpFactor / 100;

      const amount = user.baseHP * factor;

      user.modifyHP(amount, {
        context,
        affectMax: true,
        isPermanent: true,
      });

      // 🔮 Aplica o modificador de dano por 3 turnos (inclui o atual)
      user.addDamageModifier({
        id: "mar-em-ascensao",
        expiresAtTurn: currentTurn + this.effectDuration,

        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.floor(attacker.HP / this.hpPerStack);
          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          const total = baseDamage + bonus;
          return total;
        },
      });

      const userName = formatChampionName(user);
      return [
        {
          log: `${userName} invoca o Mar Primordial! HP máximo dobrado; efeito "Mar em Ascensão" ativo neste e nos próximos 2 turnos.`,
        },
      ];
    },
  },
];

export default naelthosSkills;
