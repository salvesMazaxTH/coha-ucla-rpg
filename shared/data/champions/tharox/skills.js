import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const tharoxSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  totalBlock,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "provocação_primeva",
    name: "Provocação Primeva",
    tauntDuration: 1,
    damageReductionAmount: 10,
    damageReductionDuration: 2,
    contact: false,
    priority: 3,
    description() {
      return `Provoca todos os inimigos por ${this.tauntDuration} turno(s) e ganha ${this.damageReductionAmount} de redução de dano por ${this.damageReductionDuration} turnos. Usos consecutivos têm chance de sucesso exponencialmente menor (reset ao falhar ou usar outra habilidade).`;
    },

    targetSpec: ["self"],
    resolve({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        context,
      });

      user.runtime.tauntStreak ??= 0;
      /* console.log(
        `[Skill - Provocação Primeva] ${user.name} usou Provocação Primeva. Taunt Streak atual: ${user.runtime.tauntStreak}`,
      );
      */
      const chance = 1 / Math.pow(3, user.runtime.tauntStreak); // Chance diminui exponencialmente a cada uso
      const sucess = Math.random() < chance;
      /* console.log(
        `[Skill - Provocação Primeva] ${user.name} tentou Provocação Primeva. Chance: ${chance}, Sucesso?: ${sucess}`,
      );
      */
      if (!sucess) {
        user.runtime.tauntStreak = 0; // Reset streak se a provocação for mal-sucedida

        context.registerDialog({
          message: `Mas falhou.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${formatChampionName(user)} executou <b>Provocação Primeva</b>. Mas falhou. Taunt Streak resetada.`,
        };
      }

      user.runtime.lastTauntTurn = context.currentTurn;

      if (!context.currentTurn) {
        throw new Error(
          "Context must include currentTurn for Provocação Primeva.",
        );
      }

      // se foi bem-sucedida, incrementa a tauntStreak para a próxima tentativa
      user.runtime.tauntStreak += 1;
      /* console.log(
        `[Skill - Provocação Primeva] ${user.name} usou Provocação Primeva. Taunt Streak atual: ${user.runtime.tauntStreak}`,
      );
      */
      // Get all active champions on the opposing team

      const tauntLogs = [];

      const enemyChampions = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((c) => c.team !== user.team && c.alive);

      enemyChampions.forEach((enemy) => {
        tauntLogs.push(enemy.applyTaunt(user.id, this.tauntDuration, context));
      });

      const userName = formatChampionName(user);
      // Filter out falsy (e.g., if taunt not applied)
      const logs = tauntLogs.filter(Boolean);
      logs.unshift({
        log: `${userName} executou <b>Provocação Primeva</b>. Todos os inimigos foram provocados e ${userName} recebeu ${this.damageReductionAmount} de Redução de Dano.`,
      });
      return logs;
    },
  },

  {
    key: "impacto_da_couraça",
    name: "Impacto da Couraça",
    bf: 75,
    damageMode: "standard",
    defScaling: 15,
    contact: true,
    priority: 0,
    description() {
      return `Causa dano ao inimigo somado a ${this.defScaling}% da Defesa.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage =
        (user.Attack * this.bf) / 100 + user.Defense * (this.defScaling / 100);
      const result = new DamageEvent({
        attacker: user,
        baseDamage,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return result;
    },
  },

  {
    key: "apoteose_do_monolito",
    name: "Apoteose do Monólito",
    hpGain: 50,
    defGain: 10,
    damageMode: "standard",
    modifierDuration: 3,
    defDamagePercent: 38,
    contact: false,
    ultCost: 3,
    isUltimate: true,
    priority: 0,
    description() {
      return `Ganha +${this.hpGain} HP, +${this.defGain} DEF, cura proporcional à DEF acima da base e seus ataques passam a causar dano adicional com base na Defesa excedente, escalando de forma crescente e tornando-se devastadores em níveis altos, por ${this.modifierDuration} turnos.`;
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      user.modifyHP(this.hpGain, {
        context,
        maxHPOnly: true,
        isPermanent: true,
      });

      user.modifyStat({
        statName: "Defense",
        amount: this.defGain,
        context,
        isPermanent: true,
      }); // Aumenta DEF permanentemente

      const proportionalHeal = user.Defense - user.baseDefense;
      user.heal(proportionalHeal, context);

      // Remove qualquer modificador anterior da ultimate antes de adicionar um novo
      user.damageModifiers = user
        .getDamageModifiers()
        .filter((mod) => mod.id !== "apoteose-do-monolito");

      user.addDamageModifier({
        id: "apoteose-do-monolito",
        name: "Bônus de Apoteose do Monólito",
        expiresAtTurn: context.currentTurn + this.modifierDuration,
        apply: ({ baseDamage, attacker }, context) => {
          const baseDef = attacker.baseDefense;
          const bonusDef = Math.max(0, attacker.Defense - baseDef);

          const linear = bonusDef * 0.7;
          const scaling = Math.pow(bonusDef, 1.4) * this.defDamagePercent / 100;

          let bonus = linear + scaling;

          return baseDamage + bonus;
        },
      });

      const userName = formatChampionName(user);
      return {
        log: `${userName} executou <b>Apoteose do Monólito</b>, liberando sua forma de guerra. Ganhou +${this.defGain} Defesa e +${this.hpGain} HP Máximo. Além disso, curou ${proportionalHeal} HP! (Defense: ${user.Defense}, HP: ${user.HP}/${user.maxHP})`,
      };
    },
  },
];

export default tharoxSkills;
