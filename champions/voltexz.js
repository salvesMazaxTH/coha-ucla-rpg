import { DamageEngine } from "../core/damageEngine.js";

const voltexzSkills = [
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
    key: "relampagos_gemeos",
    name: "Relâmpagos Gêmeos",
    description: `
    Cooldown: 2 turnos,
    Contato: ❌
    BF 110 (primario) / BF 110 (secundario).
    (Pode escolher o mesmo alvo para ambos)
    `,
    cooldown: 2,
    priority: 0, // prioridade padrão
    targetSpec: [{ type: "enemy" }, { type: "enemy" }],

    execute({ user, targets, context = {} }) {
      const { enemy: primary, enemy2: secondary } = targets;
      const bf = 110;
      const baseDamage = (user.Attack * bf) / 100;
      const results = [];

      const primaryResult = DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: primary,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      results.push(primaryResult);

      const secondaryResult = DamageEngine.resolveDamage({
        baseDamage,
        user,
        target: secondary,
        skill: this.name,
        context,
        allChampions: context?.allChampions,
      });
      results.push(secondaryResult);

      return results;
    },
  },
  {
    key: "choque_estatico",
    name: "Choque Estático",
    description: `
    Cooldown: 2 turnos,
    Contato: ❌
    BF 35 (Direto);
    Efeito: Alvo é paralisado por 1 turno (perde a próxima ação neste turno).`,
    cooldown: 2,
    priority: 0, // prioridade padrão
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 35;
      const baseDamage = (user.Attack * bf) / 100;
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
      enemy.applyKeyword("paralisado", 1, context, {
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
    description: `
    Cooldown: 3 turnos,
    Contato: ❌
    BF 265.`,
    cooldown: 3,
    priority: 0, // prioridade padrão
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const bf = 265;
      const baseDamage = (user.Attack * bf) / 100;
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
