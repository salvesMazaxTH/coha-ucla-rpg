import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const baraoEstrondosoSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "impacto_de_aco",
    name: "Impacto de Aço",
    bf: 120,
    contact: true,
    energyCost: 120,
    priority: -999,
    targetSpec: ["enemy"],
    description() {
      return `Causa dano bruto ao inimigo.`;
    },
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
      if (result.totalDamage > 0 && user.runtime) {
        user.runtime.storedDamage = 0; // Zera o dano armazenado após o ataque
      }
      return result;
    },
  },

  {
    key: "blindagem_reforcada",
    name: "Blindagem Reforçada",
    contact: false,
    energyCost: 65,
    priority: -999,
    description() {
      return `Aumenta a Defesa em 15 por 2 turnos e aplica o efeito "blindagem_reforcada", que aumenta sua Defesa em 15 por 2 turnose passa a armazenar 40% do dano na Passiva em vez de 30%.`;
    },
    targetSpec: [""],
    execute({ user, context }) {
      user.applyKeyword("blindagem_reforcada", 2, context);

      user.modifyStat("Defense", 15, 2, context);

      return {
        log: `${formatChampionName(user)} reforçou sua blindagem!`,
      };
    },
  },

  {
    key: "super_hiper_ultra_mega_blaster_atomico",
    name: "Super Hiper Ultra Mega Blaster Atômico",
    bf: 850,
    contact: false,
    energyCost: 470,
    priority: -999,
    description() {
      return `Causa dano massivo ao inimigo somado ao dano armazenado. Após o ataque, o dano armazenado é zerado.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const storedDamage = user.runtime?.storedDamage || 0;
      const baseDamage = (user.Attack * this.bf) / 100 + storedDamage;
      return CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).then((result) => {
        // Zera o dano armazenado após o ataque
        user.runtime.storedDamage = 0;
        return result;
      });
    },
  },
];

export default baraoEstrondosoSkills;
