import { CombatResolver } from "../../core/combatResolver.js";

const voltexzSkills = [
  {
    key: "ataque_basico",
    name: "Ataque Básico",
    bf: 60,
    contact: true,
    manaCost: 0,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
BF ${this.bf}.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return CombatResolver.resolveDamage({
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
    key: "relampagos_gemeos",
    name: "Relâmpagos Gêmeos",
    bf: 75,
    contact: false,
    manaCost: 20,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
BF ${this.bf} (primario) / BF ${this.bf} (secundario).
(Pode escolher o mesmo alvo para ambos)`;
    },
    targetSpec: [{ type: "enemy" }, { type: "enemy" }],

    execute({ user, targets, context = {} }) {
      const { enemy: primary, enemy2: secondary } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      if (primary) {
        const primaryResult = CombatResolver.resolveDamage({
          baseDamage,
          user,
          target: primary,
          skill: this.name,
          context,
          allChampions: context?.allChampions,
        });
        results.push(primaryResult);
      }

      if (secondary) {
        const secondaryResult = CombatResolver.resolveDamage({
          baseDamage,
          user,
          target: secondary,
          skill: this.name,
          context,
          allChampions: context?.allChampions,
        });
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
    manaCost: 25,
    priority: 1,
    description() {
      return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
Prioridade: +${this.priority}
BF ${this.bf} (Direto);
Efeito: Alvo é paralisado por ${this.paralyzeDuration} turno (perde a próxima ação neste turno).`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = CombatResolver.resolveDamage({
        baseDamage,
        mode: "hybrid", // 'hybrid' para Dano Direto puro ou parte Bruto e parte Direto
        directDamage: baseDamage, // Dano Direto puro
        user,
        target: enemy,
        skill: this.name,
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
          `${enemy.name} foi PARALISADO por Choque Estático e perderá sua próxima ação!`,
        );
        if (damageResult?.log) {
          damageResult.log += `\n${enemy.name} foi PARALISADO por Choque Estático e perderá sua próxima ação!`;
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
    manaCost: 40,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
BF ${this.bf}.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = CombatResolver.resolveDamage({
        baseDamage,
        user,
        target: enemy,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });

      results.push(damageResult);

      return results;
    },
  },
];

export default voltexzSkills;
