import { DamageEngine } from "../../core/damageEngine.js";
import { formatChampionName } from "../../core/formatters.js";

const sereneSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, BF 100).`,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 100;
      const baseDamage = (user.Attack * bf) / 100;
      return DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
    },
  },

  {
    key: "voto_harmonico",
    name: "Voto Harmônico",
    description: `
      Cooldown: 1 turno
      Serene sacrifica 15% do seu HP atual (Dano Direto) e concede um escudo a si mesma ou a um aliado ativo.

      Escudo:
      - Mínimo: 45
      - Se o sacrifício exceder 35 HP, o escudo ganha um bônus, tornando-se maior que a vida sacrificada.

      Regras:
      Falha de Execução: Se Serene tiver 30 de HP ou menos, esta habilidade não pode ser utilizada.`,
    cooldown: 1,
    priority: 0,
    targetSpec: ["select:ally"],

    execute({ user, targets, context = {} }) {
      const { ally } = targets;

      if (user.HP <= 30) {
        return {
          log: `${formatChampionName(user)} tentou usar Voto Harmônico, mas não possuía vitalidade suficiente.`,
        };
      }

      // ===== Sacrifício =====
      let hpSacrifice = Math.floor(user.HP * 0.15);
      hpSacrifice = Math.round(hpSacrifice / 5) * 5;

      user.takeDamage(hpSacrifice);

      // ===== Escudo =====
      const BONUS_OVERFLOW = 10;

      let shieldAmount = 45;

      if (hpSacrifice > 35) {
        shieldAmount = hpSacrifice + BONUS_OVERFLOW;
      }

      // Garantia absoluta da regra de design
      shieldAmount = Math.max(shieldAmount, hpSacrifice);

      ally.addShield(shieldAmount, 0, context);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} sacrificou ${hpSacrifice} do próprio HP e concedeu ${shieldAmount} de escudo a ${
          userName === allyName ? "si mesmo" : allyName
        }.`,
      };
    },
  },

  {
    key: "selo_da_quietude",
    name: "Selo da Quietude",
    description: `
    Cooldown: 1 turno
    BF 0.
    Dano:
    15% do HP máximo do alvo como Dano Direto (NÃO sofre redução pela Defesa).`,
    cooldown: 1,
    priority: 1,
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;

      const baseDamage = Math.floor(enemy.maxHP * 0.15);

      // aplica status
      enemy.applyKeyword("atordoado", 1, context);

      // resolve dano
      const result = DamageEngine.resolveDamage({
        mode: "hybrid",
        baseDamage,
        direct: baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });

      // adiciona log da skill
      if (result?.log) {
        result.log += `\n${enemy.name} foi atordoado pela Quietude!`;
      } else {
        result.log = `${enemy.name} foi atordoado pela Quietude!`;
      }

      return result;
    },
  },

  {
    key: "epifania_do_limiar",
    name: "Epifania do Limiar",
    description: `
    Cooldown: 2 turnos
    Ao ativar, até que a próxima ação de Serene seja resolvida:
    1️⃣ Proteção de Campo
    Aliados ativos recebem:
    −30 de dano de todas as fontes (respeita o piso mínimo de 10)
    2️⃣ Limiar da Existência (Auto-Resgate)
    Se o HP de Serene cairia a 0 ou menos, em vez disso:
    Ela permanece com 50 de HP travados (se não estivesse com menos de 50 de HP)
    A partir desse momento, Serene ganha:
    'Imunidade Absoluta': Serene não pode receber dano ou efeitos negativos de nenhuma fonte até que sua próxima ação seja resolvida.`,
    cooldown: 3,
    priority: 2,
    targetSpec: ["all:ally"],
    execute({ user, context = {} }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      // 1️⃣ Proteção de Campo
      allies.forEach((ally) => {
        ally.applyDamageReduction({
          amount: 30,
          duration: 2, // acaba um turno antes da ult voltar do cooldown
          source: "epifania",
        });
        ally.applyKeyword("epifania_ativa", {
          persistent: true,
        });
      });

      return {
        log: `${formatChampionName(user)} alcança o Limiar da Existência.
        Aliados recebem proteção de campo!`,
      };
    },
  },
];

export default sereneSkills;
