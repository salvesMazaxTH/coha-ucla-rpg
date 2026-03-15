import { formatChampionName } from "../../../../public/js/ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicAttack from "../basicAttack.js";

const vulnaraSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================

  // ========================
  // H1 - Flecha Flamejante
  // ========================

  {
    key: "flecha_flamejante",
    name: "Flecha Flamejante",
    bf: 65,

    burnBonus: 20,

    contact: false,
    damageMode: "standard",
    priority: 0,

    element: "fire",

    description() {
      return `Dispara uma flecha de fogo que causa dano. Contra inimigos queimando, causa +${this.burnBonus} de dano e sempre acerta crítico.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      let baseDamage = (user.Attack * this.bf) / 100;

      const burning = enemy.hasStatusEffect("queimando");

      if (burning) {
        baseDamage += this.burnBonus;
      }

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        critOptions: burning ? { force: true } : undefined,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // H2 - Chuva de Flechas de Fogo
  // ========================

  {
    key: "chuva_de_flechas_de_fogo",
    name: "Chuva de Flechas de Fogo",

    bf: 40,
    burnChance: 0.15,
    damageMode: "standard",
    contact: false,
    priority: 0,

    element: "fire",

    description() {
      return `Dispara uma chuva de flechas flamejantes atingindo todos os inimigos. Cada acerto tem 15% de chance de aplicar Queimando.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      // Pegar todos os inimigos (time diferente do usuário)
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      // Aplicar dano em cada inimigo
      for (const enemy of enemies) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        // Aplicar queimando com 15% de chance
        if (Math.random() < this.burnChance) {
          enemy.applyStatusEffect("queimando", 2, context);
        }

        results.push(damageResult);
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Saraivada de Fogo
  // ========================

  {
    key: "saraivada_de_fogo",
    name: "Saraivada de Fogo",

    element: "fire",

    bf: 45,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    ultCost: 3,
    priority: 0,

    description() {
      return `Dispara três flechas flamejantes contra o mesmo alvo. Cada acerto pode critar independentemente.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const results = [];

      for (let i = 0; i < 3; i++) {
        const baseDamage = (user.Attack * this.bf) / 100;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(result);
      }

      return results;
    },
  },
];

export default vulnaraSkills;
