import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicAttack from "../basicAttack.js";

const eliasCrossSkills = [
  // =========================
  // Ataque Básico
  // =========================
  basicAttack,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "impacto_relampago",
    name: "Impacto Relâmpago",
    bf: 80,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    damageBonusMode: "absolute",
    priority: 0,
    cannotBeEvaded: true,
    element: "lightning",
    description() {
      return `Se o alvo tiver "Condutor", causa ${this.damageBonus} de dano absoluto a mais. Esse ataque não pode ser esquivado.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const isOverloaded = enemy.hasStatusEffect("condutor");
      /* console.log(
        `Impacto Relâmpago: ${formatChampionName(enemy)} ${isOverloaded ? "está" : "não está"} sobrecarregado. StatusEffects do alvo: ${[...enemy.statusEffects.keys()].join(", ")}`,
      );
      */
      const results = [];

      const pushResult = (r) => {
        if (Array.isArray(r)) results.push(...r);
        else if (r) results.push(r);
      };

      const result = new DamageEvent({
        baseDamage: isOverloaded ? baseDamage + this.damageBonus : baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      pushResult(result);

      return results;
    },
  },

  {
    key: "carga_latente",
    name: "Carga Latente",
    bf: 25,
    contact: false,
    damageMode: "standard",
    damageBonus: 15,
    damageBonusMode: "absolute",
    priority: 0,
    element: "lightning",
    description() {
      return `Elias Cross ganha +35% de chance na passiva no próximo turno apenas. Se o alvo tiver "Condutor", causa ${this.damageBonus} de dano absoluto a mais.`;
    },
    targetSpec: ["enemy", "self"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;

      // Aplica bônus temporário
      user.runtime.passiveBonusNextTurn = 35;

      const baseDamage = (user.Attack * this.bf) / 100;
      const isOverloaded = enemy.hasStatusEffect("condutor");

      const results = [];

      const pushResult = (r) => {
        if (Array.isArray(r)) results.push(...r);
        else if (r) results.push(r);
      };

      const result = new DamageEvent({
        baseDamage: isOverloaded ? baseDamage + this.damageBonus : baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      pushResult(result);

      return results;
    },
  },

  {
    key: "tempestade_de_raios",
    name: "Tempestade de Raios",
    bf: 135,
    damageMode: "standard",
    isUltimate: true,
    ultCost: 3,
    recoilDamage: 40,
    recoilDamageMode: "absolute",
    contact: false,
    priority: 0,
    cannotBeEvaded: true,
    element: "lightning",
    description() {
      return `Causa dano a TODOS os personagens, não afeta o próprio Elias e nem aliados com 'Afinidade: Raio' ou 'Terra'. No entanto, Elias sofre ${this.recoilDamage} de dano absoluto de recuo. Quaisquer dos alvos que  estiverem abaixo de 17% do HP são {obliterados}, e caso tenham "Condutor", o percentual necessário é apenas 25%. Esse ataque não pode ser esquivado.`;
    },

    obliterateRule(ctx) {
      const target = ctx.target;
      const hasOverload = target.hasStatusEffect("condutor");
      return hasOverload ? 0.25 : 0.17;
    },

    targetSpec: ["all"],
    resolve({ user, targets, context }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      const targetList = Array.isArray(targets)
        ? targets
        : targets
          ? [targets]
          : [];

      let lastValidTargetIndex = -1;

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (target === user) continue;

        const affinities = target.elementalAffinities || [];
        // só os aliados que possuem afinidade com raio ou terra ficam imunes
        if (
          target.team === user.team &&
          (affinities.includes("lightning") || affinities.includes("earth"))
        )
          continue;

        lastValidTargetIndex = i;
      }

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (target === user) continue;

        const affinities = target.elementalAffinities || [];

        if (
          target.team === user.team &&
          (affinities.includes("lightning") || affinities.includes("earth"))
        )
          continue;

        // se o alvo é o último, injeta recoil
        if (i === lastValidTargetIndex) {
          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            baseDamage: this.recoilDamage,
            mode: this.recoilDamageMode,
            attacker: user,
            defender: user,
            skill: this,
          });
        }

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: target,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      return results;
    },
  },
];

export default eliasCrossSkills;
