import { DamageEngine } from "../core/damageEngine.js";
import { formatChampionName } from "../core/formatters.js";

const sereneSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    description: `O ataque básico genérico (0 cooldown, Dano = 100% ATQ).`,
    cooldown: 0,
    priority: 0, // Default priority
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = user.Attack;
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
    Escudo = 45
    Regras:
    Falha de Execução: Se Serene tiver 30 de HP ou menos, este modo não pode ser declarado.
    `,
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

      let hpSacrifice = Math.floor(user.HP * 0.15);
      hpSacrifice = Math.round(hpSacrifice / 5) * 5;

      user.takeDamage(hpSacrifice);
      ally.addShield(45, 0, context);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${formatChampionName(user)} sacrificou ${hpSacrifice} HP para proteger ${formatChampionName(ally)} com um escudo.`,
      };
    },
  },

  {
    key: "selo_da_quietude",
    name: "Selo da Quietude",
    description: `
    Cooldown: 1 turno
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
      if (result) {
        result.log += `\n${enemy.name} foi atordoado pela Quietude!`;
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
    cooldown: 2,
    priority: 1,
    targetSpec: ["all:ally"],
    execute({ user, context = {} }) {
      const allies = context.aliveChampions.filter(
  c => c.team === user.team
);
      // 1️⃣ Proteção de Campo
      allies.forEach((ally) => {
        ally.applyDamageReduction({
          amount: 30,
          duration: 2,
          source: "epifania",
        });
        ally.applyKeyword("epifania_ativa", {
        persistent: true,
        });
      }
      
      return {
        log: `${formatChampionName(user)} alcança o Limiar da Existência.`,
      };
    },
  },
];

export default sereneSkills;
