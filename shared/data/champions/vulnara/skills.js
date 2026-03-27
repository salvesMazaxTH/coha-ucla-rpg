import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicShot from "../basicShot.js";

const vulnaraSkills = [
  // ========================
  // Disparo Básico (global)
  // ========================
  basicShot,
  // ========================
  // Habilidades Especiais
  // ========================

  // ========================
  // H1 - Instintos Predatórios
  // ========================

  {
    key: "instinto_predatorio",
    name: "Instinto Predatório",

    critBuff: 30,
    duration: 2,

    contact: false,
    priority: 0,

    description() {
      return `Aguça seus sentidos de combate, ganhando +${this.critBuff}% de chance de crítico por ${this.duration} turnos.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Critical",
        amount: this.critBuff,
        duration: this.duration,
        context,
      });

      return {
        log: `${formatChampionName(user)} aguçou seus instintos e ganhou +${this.critBuff}% de crítico por ${this.duration} turnos!`,
      };
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
        // Aplicar queimando com 15% de chance (só se o golpe chegou)
        if (!damageResult?.evaded && !damageResult?.immune && Math.random() < this.burnChance) {
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
