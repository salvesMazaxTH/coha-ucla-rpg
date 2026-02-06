import { DamageEngine } from "../core/damageEngine.js";

const naelysSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, Dano = 100% ATQ).`,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context }) {
      const { enemy } = targets;
      const baseDamage = user.Attack;
      return DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
      });
    },
  },

  {
    key: "toque_da_mare_serena",
    name: "Toque da Maré Serena",
    description: ` Cooldown: 1 turno
Contato: ❌
Inimigo alvo sofre:
Dano Bruto = Base 15 + ATQ
Aliado ativo recupera:
    Cura = 45 de HP
`,
    cooldown: 1,
    priority: 0, // Default priority
    targetSpec: ["enemy", "ally"],

    execute({ user, targets, context }) {
      const { enemy, ally } = targets;

      const baseDamage = 15 + user.Attack;
      const healAmount = 45;

      // 🗡️ Dano no inimigo
      const damageResult = DamageEngine.resolveRaw({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
      });

      const logs = [damageResult];
      let allyLog = "";
      let statLog = "";

      // 💧 Cura no aliado (se existir)
      if (ally) {
        ally.HP = Math.min(ally.HP + healAmount, ally.maxHP);
        ally.updateUI();
        allyLog = `${user.name} cura ${ally.name} em ${healAmount} de HP.`;
      } else {
        allyLog = `${user.name} tenta curar um aliado, mas nenhum está disponível.`;
      }

      logs.push({
        log: `${allyLog} ${statLog}`,
      });

      return logs;
    },
  },

  {
    key: "forma_aquatica",
    name: "Forma Aquática",
    description: `Transforma-se em uma massa de água pura.
    Efeitos: Inerte + Imunidade Absoluta
    Duração: 2 turnos (pode ser interrompido se executar uma ação)`,
    cooldown: 2,
    priority: 0,
    targetSpec: ["self"],

    execute({ user, context }) {
      const { currentTurn } = context;

      // Apply keywords
      user.applyKeyword("inerte", 2, context, {
        canBeInterruptedByAction: true,
      });
      user.applyKeyword("imunidade absoluta", 2, context);

      return {
        log: `${user.name} usa Forma Aquática! Está Inerte e com Imunidade Absoluta até o turno ${currentTurn + 2}. (Pode ser interrompido por ação do usuário).`,
      };
    },
  },

  {
    key: "transbordar_do_mar_primordial",
    name: "Transbordar do Mar Primordial",
    description: `Naelys aumenta seu HP em 65%. Além disso, ele recupera: 
    +50 de HP
    Por 3 turnos (inclui o atual):
    Naelys ganha o efeito: Mar em Ascensão, que enquanto estiver ativo:
    Todos os Ataques que causem dano recebem:
    ➡️ +20 de Dano Bruto para cada 20 de HP ATUAL que ele tiver
    (Arredondado para múltiplo de 5)
    Limite de Escala: O bônus de dano não pode exceder +140 de Dano Bruto por ação.`,
    cooldown: 4,
    priority: 0, // Default priority
    targetSpec: ["self"],

    execute({ user, context }) {
      const { currentTurn } = context;
      console.log("ULT EXECUTADA:", user.name, "TURNO:", currentTurn);

      const oldMax = user.maxHP;
      const factor = 1.65;

      // Aumenta o máximo (+65%)
      user.maxHP = oldMax * factor;

      // Aumenta o HP atual proporcionalmente
      user.HP = Math.round(user.HP * factor);

      // Cura +50 sem passar do novo máximo
      user.HP = Math.min(user.HP + 50, user.maxHP);
      
      // Em qualquer caso o limite global de HP é 999
      user.HP = Math.min(user.HP, 999);
      user.maxHP = Math.min(user.maxHP, 999);

      // 🔮 Aplica o modificador de dano por 3 turnos (inclui o atual)
      user.addDamageModifier({
        id: "mar-em-ascensao",
        expiresAtTurn: currentTurn + 3,

        apply: ({ baseDamage, user }) => {
          const stacks = Math.floor(user.HP / 30);
          const bonus = Math.min(stacks * 20, 160); // cap +160

          const total = baseDamage + bonus;
          return total;
        },
      });

      return {
        log: `${user.name} invoca o Mar Primordial! HP máximo dobrado; efeito "Mar em Ascensão" ativo neste e nos próximos 2 turnos.`,
      };
    },
  },
];

export default naelysSkills;
