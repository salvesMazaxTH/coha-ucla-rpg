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
    bf: 100,
    contact: true,
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

    priority: -999,
    defenseBuff: 5,
    defBuffDuration: 2,

    description() {
      return `Aumenta a Defesa em 15 por 2 turnos e aplica o efeito "blindagem_reforcada", que aumenta sua Defesa em ${this.defenseBuff} por ${this.defBuffDuration} turnos e passa a armazenar 40% do dano na Passiva em vez de 30%.`;
    },
    targetSpec: ["self"],
    execute({ user, context }) {
      user.applyKeyword("blindagem_reforcada", 2, context);

      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.defBuffDuration,
        context,
      });

      return {
        log: `${formatChampionName(user)} reforçou sua blindagem!`,
      };
    },
  },

  {
    key: "super_hiper_ultra_mega_blaster_atomico",
    name: "Super Hiper Ultra Mega Blaster Atômico",
    bf: 600,
    contact: false,

    priority: -999,

    isUltimate: true,
    ultCost: 4,

    description() {
      return `Causa dano ABSURDO ao inimigo somado ao dano armazenado. Este ataque é sempre um acerto Crítico. Após o ataque, o dano armazenado é zerado.`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const storedDamage = user.runtime?.storedDamage || 0;
      const baseDamage = (user.Attack * this.bf) / 100 + storedDamage;
      const damageResult = CombatResolver.processDamageEvent({
        baseDamage,
        user,
        target: enemy,
        skill: this,
        context,
        critOptions: { force: true }, // crítico garantido
        allChampions: context?.allChampions,
      });
      // Zera o dano armazenado após o ataque
      user.runtime.storedDamage = 0;
      return damageResult;
    },
  },
];

export default baraoEstrondosoSkills;
