import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const lanaSkills = [
  // ========================
  // Bloqueio Básico (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "nao_faz_isso",
    name: "Não Faz Isso!",

    priority: 3,

    description() {
      return `Lana bloqueia a próxima habilidade ativa do alvo. A ação falha, se for uma ultimate, o alvo perde o recurso normalmente.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      //return results;
    },
  },

  {
    key: "arremesso_telecinetico",
    name: "Arremesso Telecinético",

    bf: 95,
    damageMode: "standard",
    contact: false,

    description() {
      return `Lana arremessa o alvo com força psíquica.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "surto_psiquico",
    name: "Surto Psíquico",

    bf: 120,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    ultCost: 3,

    priority: 0,
    description() {
      return `Lana libera um surto psíquico, causando dano massivo a todos os inimigos, o dano aumenta baseado em quanto de HP Lana perdeu.`;
    },
    resolve({ user, targets, context = {} }) {
      // Pegar todos os inimigos (time diferente do usuário)
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      // Aplicar dano em cada inimigo
      for (const enemy of enemies) {
        // ...
      }
    },
  },
];

export default lanaSkills;
