import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const eliasCrossSkills = [
  // =========================
  // Bloqueio Total (global)
  // =========================
  totalBlock,
  // =========================
  // Habilidades Especiais
  // =========================
  {
    key: "impacto_relampago",
    name: "Impacto Relâmpago",
    bf: 70,
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

      const isOverloaded = enemy.hasStatusEffect("conductor");
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
        type: "magical",
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
      return `Elias Cross ganha +35% de chance na passiva neste turno e no próximo (expira em currentTurn + 2). Se o alvo tiver "Condutor", causa ${this.damageBonus} de dano absoluto a mais.`;
    },
    targetSpec: ["enemy", "self"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;

      // Aplica o bônus temporário e guarda o valor REAL aplicado para expirar corretamente.
      const initialChance = user.passive?.initialChance ?? 1;
      const currentChance = user.runtime.passiveChance ?? initialChance;
      const nextChance = Math.min(100, currentChance + 35);
      const appliedBonus = Math.max(0, nextChance - currentChance);

      user.runtime.passiveChance = nextChance;

      if (appliedBonus > 0) {
        user.runtime.passiveTempBuffs ??= [];
        user.runtime.passiveTempBuffs.push({
          amount: appliedBonus,
          expiresAtTurn: (context?.currentTurn ?? 0) + 2,
        });
      }

      const baseDamage = (user.Attack * this.bf) / 100;
      const isOverloaded = enemy.hasStatusEffect("conductor");

      const result = new DamageEvent({
        baseDamage: isOverloaded ? baseDamage + this.damageBonus : baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "tempestade_de_raios",
    name: "Tempestade de Raios",
    bf: 120,

    damageMode: "standard",

    isUltimate: true,
    ultCost: 4,

    recoilDamage: 25,
    reductedDamagePercent: 20,
    recoilDamageMode: "absolute",

    cannotBeEvaded: true,

    contact: false,
    priority: 0,

    element: "lightning",

    description() {
      return `Causa dano a TODOS os personagens, não afeta o próprio Elias. Personagens com 'Afinidade: Raio' ou 'Terra' sofrem apenas ${this.reductedDamagePercent}% do dano. No entanto, Elias sofre ${this.recoilDamage}% de sua vida máxima como dano absoluto de recuo. Quaisquer dos alvos que estiverem abaixo de 17% do HP são obliterados, e caso tenham "Condutor", o percentual necessário é apenas 25%. Esse ataque não pode ser esquivado.`;
    },

    finishingType: "obliterate",

    finishingRule(ctx) {
      const target = ctx.defender;
      const hasOverload = target.hasStatusEffect("conductor");
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

      // acha uma única iteração válida pra acoplar o recoil
      const recoilIndex = targetList.findIndex((t) => t?.alive && t !== user);

      for (let i = 0; i < targetList.length; i++) {
        const target = targetList[i];

        if (!target?.alive) continue;
        if (target === user) continue;

        const affinities = target.elementalAffinities || [];

        let finalBaseDamage = baseDamage;

        if (affinities.includes("lightning") || affinities.includes("earth")) {
          finalBaseDamage = baseDamage * (this.reductedDamagePercent / 100);
        }

        // 🔥 injeta recoil em UMA única execução válida
        if (i === recoilIndex) {
          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            baseDamage: (user.maxHP * this.recoilDamage) / 100,
            mode: this.recoilDamageMode,
            attacker: user,
            defender: user,
            type: "magical",
            skill: this,
          });
        }

        const result = new DamageEvent({
          baseDamage: finalBaseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      const eliasUltLog = `${formatChampionName(user)} sofreu ${this.recoilDamage}% de sua vida máxima como dano absoluto de recuo.`;

      // injeta em apenas UM resultado (o primeiro válido)
      if (results.length > 0) {
        results[0].log = (results[0].log ?? "") + `\n${eliasUltLog}`;
      } else {
        // fallback opcional
        console.warn(
          "Tempestade de Raios: nenhum resultado para anexar log de recoil",
        );
      }

      return results;
    },
  },
];

export default eliasCrossSkills;
