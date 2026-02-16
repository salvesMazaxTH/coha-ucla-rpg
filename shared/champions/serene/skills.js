import { DamageEngine } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const sereneSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    bf: 60,
    contact: true,
    cooldown: 0,
    priority: 0,
    description() {
      return `O ataque básico genérico (${this.cooldown} cooldown, BF ${this.bf}).
Contato: ${this.contact ? "✅" : "❌"}`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
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
    shieldFull: 60,
    shieldReduced: 35,
    hpThreshold: 65,
    contact: false,
    cooldown: 1,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turno
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
    cooldown: 1,
    priority: 1,
    description() {
      return `Cooldown: ${this.cooldown} turno
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
      enemy.applyKeyword("atordoado", this.stunDuration, context);

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
    damageReduction: 30,
    reductionDuration: 2,
    surviveHP: 50,
    contact: false,
    cooldown: 3,
    priority: 4,
    description() {
      return `Cooldown: ${this.cooldown} turnos
Prioridade: +${this.priority}
Ao ativar, até que a próxima ação de Serene seja resolvida:
1️⃣ Proteção de Campo
Aliados ativos recebem:
−${this.damageReduction} de dano de todas as fontes (respeita o piso mínimo de 10)
2️⃣ Limiar da Existência (Auto-Resgate)
Se o HP de Serene cairia a 0 ou menos, em vez disso:
Ela permanece com ${this.surviveHP} de HP travados (se não estivesse com menos de ${this.surviveHP} de HP)
A partir desse momento, Serene ganha:
'Imunidade Absoluta': Serene não pode receber dano ou efeitos negativos de nenhuma fonte até que sua próxima ação seja resolvida.`;
    },
    targetSpec: ["all:ally"],
    execute({ user, context = {} }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      // 1️⃣ Proteção de Campo
      allies.forEach((ally) => {
        ally.applyDamageReduction({
          amount: this.damageReduction,
          duration: this.reductionDuration,
          source: "epifania",
          context,
        });
        ally.applyKeyword("epifania_ativa", {
          metadata: {
            persistent: true,
          },
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
