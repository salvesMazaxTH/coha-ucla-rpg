import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";
import elementEmoji from "./elementEmoji.js";

const naelthosSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "toque_da_mare_serena",
    name: "Toque da Maré Serena",
    bf: 75,
    healAmount: 45,
    contact: false,
    manaCost: 80,
    priority: 0,
    element: "water",
    description() {
      return `Elemento: ${elementEmoji[this.element] || "❔"}\nCusto: ${this.manaCost} MP\n         Contato: ${this.contact ? "✅" : "❌"}\n         Inimigo alvo sofre:\n         Dano Bruto = BF ${this.bf}\n         Aliado ativo mais ferido recupera:\n         Cura = ${this.healAmount} de HP`;
    },
    targetSpec: ["enemy"],

    execute({ user, targets, context = {} }) {
      const { enemy } = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const healAmount = this.healAmount;

      const logs = [];

      // 🗡️ Dano no inimigo (se ainda vivo)
      if (enemy) {
        const damageResult = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        logs.push(damageResult);
      }
      let allyLog = "";
      let statLog = "";

      const moreInjuredAlly = context.allChampions
        .filter((champ) => champ.team === user.team && champ.HP > 0)
        .sort((a, b) => a.HP / a.maxHP - b.HP / b.maxHP)[0];
      const ally = moreInjuredAlly || null;

      // 💧 Cura no aliado (se existir)
      if (ally) {
        ally.heal(healAmount, context);
        const userName = formatChampionName(user);
        const allyName = formatChampionName(ally);
        allyLog = `${userName} cura ${allyName} em ${healAmount} de HP. HP final de ${allyName}: ${ally.HP}/${ally.maxHP}`;
      } else {
        const userName = formatChampionName(user);
        allyLog = `${userName} tenta curar um aliado, mas nenhum está disponível.`;
      }

      logs.push({
        log: `${allyLog} ${statLog}`,
      });

      return { logs };
    },
  },

  {
    key: "forma_aquatica",
    name: "Forma Aquática",
    effectDuration: 2,
    contact: false,
    manaCost: 140,
    priority: 1,
    element: "water",
    description() {
      return `Elemento: ${elementEmoji[this.element] || "❔"}\nCusto: ${this.manaCost} MP\n             Transforma-se em uma massa de água pura.\n             Efeitos: Inerte + Imunidade Absoluta\n             Duração: ${this.effectDuration} turnos (pode ser interrompido se executar uma ação)`;
    },
    targetSpec: ["self"],

    execute({ user, context = {} }) {
      const { currentTurn } = context;

      // Apply keywords
      user.applyKeyword("inerte", this.effectDuration, context, {
        canBeInterruptedByAction: true,
      });
      user.applyKeyword("imunidade absoluta", this.effectDuration, context);

      const userName = formatChampionName(user);
      return {
        log: `${userName} usa Forma Aquática! Está Inerte e com Imunidade Absoluta até o turno ${currentTurn + this.effectDuration}. (Pode ser interrompido por ação do usuário).`,
      };
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
    maxBonus: 160,
    contact: false,
    element: "water",
    manaCost: 380,
    priority: 0,
    description() {
      return `Elemento: ${elementEmoji[this.element] || "❔"}\nCusto: ${this.manaCost} MP\n        Naelthos aumenta seu HP em ${this.hpFactor}% do HP base. Além disso, ele recupera:\n        +${this.healAmount} de HP\n        Por ${this.effectDuration} turnos (inclui o atual):\n        Naelthos ganha o efeito: Mar em Ascensão, que enquanto estiver ativo:\n        Todos os Ataques que causem dano recebem:\n        ➡️ +${this.bonusPerStack} de Dano Bruto para cada ${this.hpPerStack} de HP ATUAL que ele tiver\n        (Arredondado para múltiplo de 5)\n        Limite de Escala: O bônus de dano não pode exceder +${this.maxBonus} de Dano Bruto por ação.`;
    },
    targetSpec: ["self"],

    execute({ user, context = {} }) {
      const { currentTurn } = context;
      console.log("ULT EXECUTADA:", user.name, "TURNO:", currentTurn);

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

        apply: ({ baseDamage, user }) => {
          const stacks = Math.floor(user.HP / this.hpPerStack);
          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          const total = baseDamage + bonus;
          return total;
        },
      });

      const userName = formatChampionName(user);
      return {
        log: `${userName} invoca o Mar Primordial! HP máximo dobrado; efeito "Mar em Ascensão" ativo neste e nos próximos 2 turnos.`,
      };
    },
  },
];

export default naelthosSkills;
