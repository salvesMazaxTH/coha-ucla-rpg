import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

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
    manaCost: 600,
    priority: 0,
    element: "lightning",
    description() {
      return `Causa dano bruto em até dois inimigos (pode escolher o mesmo alvo para ambos).`;
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
    bf: 20,
    paralyzeDuration: 1,
    contact: false,
    manaCost: 300,
    priority: 1,
    element: "lightning",
    description() {
      return `Causa dano bruto (BF ${this.bf}) e paralisa o alvo por ${this.paralyzeDuration} turno(s), fazendo-o perder a próxima ação.`;
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
    manaCost: 700,
    priority: 0,
    element: "lightning",
    description() {
      return `Causa dano bruto massivo ao inimigo.`;
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
