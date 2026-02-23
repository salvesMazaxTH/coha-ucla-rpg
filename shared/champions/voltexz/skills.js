import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";
import elementEmoji from "../elementEmoji.js";

const voltexzSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "relampagos_gemeos",
    name: "Relâmpagos Gêmeos",
    bf: 45,
    contact: false,
    manaCost: 200,
    priority: 0,
    element: "lightning",
    description() {
      return `Elemento: ${elementEmoji[this.element] || "❔"}\nCusto: ${this.manaCost} MP\n        Contato: ${this.contact ? "✅" : "❌"}\n        BF ${this.bf} (primario) / BF ${this.bf} (secundario).\n        (Pode escolher o mesmo alvo para ambos)`;
    },
    targetSpec: [{ type: "enemy" }, { type: "enemy" }],

    execute({ user, targets, context = {} }) {
      const { enemy: primary, enemy2: secondary } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      if (primary) {
        const primaryResult = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target: primary,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        console.log("🌊 Target affinities:", primary.elementalAffinities);
        results.push(primaryResult);
      }

      if (secondary) {
        const secondaryResult = CombatResolver.processDamageEvent({
          baseDamage,
          user,
          target: secondary,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
        console.log("🌊 Target affinities:", secondary.elementalAffinities);
        results.push(secondaryResult);
      }

      return results;
    },
  },
  {
    key: "choque_estatico",
    name: "Choque Estático",
    bf: 25,
    paralyzeDuration: 1,
    contact: false,
    manaCost: 60,
    priority: 1,
    element: "lightning",
    description() {
      return `Elemento: ${elementEmoji[this.element] || "❔"}\nCusto: ${this.manaCost} MP\n        Contato: ${this.contact ? "✅" : "❌"}\n        Prioridade: +${this.priority}\n        BF ${this.bf} (Direto);\n        Efeito: Alvo é paralisado por ${this.paralyzeDuration} turno (perde a próxima ação neste turno).`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = CombatResolver.processDamageEvent({
        baseDamage,
        mode: "hybrid", // 'hybrid' para Dano Direto puro ou parte Bruto e parte Direto
        directDamage: baseDamage, // Dano Direto puro
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      results.push(damageResult);
      // Aplica o efeito de paralisia
      const paralyzed = enemy.applyKeyword(
        "paralisado",
        this.paralyzeDuration,
        context,
        {
          // nao reduz nada, apenas perde a ação
        },
      );

      if (paralyzed) {
        console.log(
          `${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`,
        );
        if (damageResult?.log) {
          damageResult.log += `\n${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`;
        }
      }

      return results;
    },
  },

  {
    key: "descarga_cataclismica",
    name: "Descarga Cataclísmica",
    bf: 185,
    contact: false,
    manaCost: 400,
    priority: 0,
    element: "lightning",
    description() {
      return `Elemento: ${elementEmoji[this.element] || "❔"}\nCusto: ${this.manaCost} MP\n        Contato: ${this.contact ? "✅" : "❌"}\n        BF ${this.bf}.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });

      results.push(damageResult);

      return results;
    },
  },
];

export default voltexzSkills;
