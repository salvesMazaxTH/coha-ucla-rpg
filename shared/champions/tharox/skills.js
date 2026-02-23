import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const tharoxSkills = [
  // ========================
  // Ataque Básico
  // ========================
  basicAttack,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "provocação_primeva",
    name: "Provocação Primeva",
    tauntDuration: 1,
    damageReductionAmount: 20,
    damageReductionDuration: 2,
    contact: false,
    manaCost: 180,
    priority: 2,
    description() {
      return `Custo: ${this.manaCost} MP
      Tharox solta um bramido bestial.
      Efeitos neste turno:
      Todos os inimigos ativos são Provocados
      → Devem mirar Tharox se causarem dano
      Tharox recebe:
      −${this.damageReductionAmount} de Dano Bruto Final recebido
      (respeita o Piso de 10)`;
    },
    targetSpec: ["self"],
    execute({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        context,
      });

      // Get all active champions on the opposing team
      const enemyChampions = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((c) => c.team !== user.team && c.alive);

      enemyChampions.forEach((enemy) => {
        enemy.applyTaunt(user.id, this.tauntDuration, context);
      });

      const userName = formatChampionName(user);
      return {
        log: `${userName} executou Provocação Primeva. Todos os inimigos foram provocados e ${userName} recebeu -${this.damageReductionAmount} de Dano Bruto Final.`,
      };
    },
  },

  {
    key: "impacto_da_couraça",
    name: "Impacto da Couraça",
    bf: 80,
    defScaling: 20,
    contact: true,
    manaCost: 60,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
Dano:
BF ${this.bf} + ${this.defScaling}% DEF`;
    },
    targetSpec: ["enemy"],
    execute({ user, targets, context = {} }) {
      const { enemy } = targets;
      const baseDamage =
        (user.Attack * this.bf) / 100 + user.Defense * (this.defScaling / 100);
      const result = CombatResolver.processDamageEvent({
        user,
        baseDamage,
        target: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      });
      return result;
    },
  },

  {
    key: "apoteose_do_monolito",
    name: "Apoteose do Monólito",
    hpGain: 50,
    defGain: 10,
    baseDef: 205,
    defDamagePercent: 45,
    maxDamageBonus: 80,
    modifierDuration: 3,
    contact: false,
    manaCost: 300,
    priority: 0,
    description() {
      return `Custo: ${this.manaCost} MP
      Tharox libera sua forma de guerra.
      Ao ativar:
      Ganha +${this.hpGain} HP
      Ganha +${this.defGain} DEF
      Cura a si mesmo em:
      5 HP para cada +5 DEF adicional que ele tiver acima da DEF base (${this.baseDef})
      Enquanto estiver ativo:
      Ataques que causam dano passam a causar um bônus de dano igual a ${this.defDamagePercent}% da DEF atual de Tharox (com um teto de ${this.maxDamageBonus} de dano adicional).`;
    },
    targetSpec: ["self"],
    execute({ user, context = {} }) {
      user.modifyHP(this.hpGain, { maxHPOnly: true });
      user.modifyStat({
        statName: "Defense",
        amount: this.defGain,
        context,
        isPermanent: true,
      }); // Aumenta DEF permanentemente
      const proportionalHeal =
        Math.floor((user.Defense - this.baseDef) / 5) * 5;
      user.heal(proportionalHeal, context);

      user.addDamageModifier({
        id: "apoteose-do-monolito",
        name: "Bônus de Apoteose do Monólito",
        expiresAtTurn: context.currentTurn + this.modifierDuration,

        apply: ({ baseDamage, user }) => {
          const bonus = Math.min(
            Math.floor(user.Defense * (this.defDamagePercent / 100)),
            this.maxDamageBonus,
          );
          return baseDamage + bonus;
        },
      });

      const userName = formatChampionName(user);
      return {
        log: `${userName} executou Apoteose do Monólito, liberando sua forma de guerra. Ganhou +${this.defGain} Defesa e +${this.hpGain} HP Máximo. Além disso, curou ${proportionalHeal} HP! (Defense: ${user.Defense}, HP: ${user.HP}/${user.maxHP})`,
      };
    },
  },
];

export default tharoxSkills;
