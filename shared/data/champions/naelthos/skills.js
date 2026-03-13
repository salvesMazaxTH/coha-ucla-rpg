import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

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

      const logs = [];

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
        logs.push(damageResult);
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

    priority: 2,
    element: "water",
    description() {
      return `Transforma-se em água pura, ficando "Inerte" e com "Imunidade Absoluta" por ${this.effectDuration} turnos. Pode ser interrompido se executar uma ação.`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const { currentTurn } = context;

      // Apply statusEffects
      user.applyStatusEffect("inerte", this.effectDuration, context, {
        canBeInterruptedByAction: true,
      });
      user.applyStatusEffect("imunidadeAbsoluta", this.effectDuration, context);

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

        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.floor(attacker.HP / this.hpPerStack);
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
