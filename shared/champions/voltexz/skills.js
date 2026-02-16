import { DamageEngine } from "../../core/combatResolver.js";

const voltexzSkills = [
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
    key: "relampagos_gemeos",
    name: "Relâmpagos Gêmeos",
    bf: 75,
    contact: false,
    cooldown: 2,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turnos
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
        const primaryResult = DamageEngine.resolveDamage({
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
        const secondaryResult = DamageEngine.resolveDamage({
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
    cooldown: 2,
    priority: 1,
    description() {
      return `Cooldown: ${this.cooldown} turnos
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
      const damageResult = DamageEngine.resolveDamage({
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
      enemy.applyKeyword("paralisado", this.paralyzeDuration, context, {
        // nao reduz nada, apenas perde a ação
      });
      console.log(
        `${enemy.name} foi PARALISADO por Choque Estático e perderá sua próxima ação!`,
      );

      return results;
    },
  },

  {
    key: "descarga_cataclismica",
    name: "Descarga Cataclísmica",
    bf: 185,
    contact: false,
    cooldown: 3,
    priority: 0,
    description() {
      return `Cooldown: ${this.cooldown} turnos
Contato: ${this.contact ? "✅" : "❌"}
BF ${this.bf}.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = DamageEngine.resolveDamage({
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
