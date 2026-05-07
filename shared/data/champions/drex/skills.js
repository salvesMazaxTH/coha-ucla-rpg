import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const drexSkills = [
  basicStrike,

  {
    key: "incisao_carmesim",
    name: "Incisão Carmesim",

    bf: 35,
    contact: true,
    damageMode: "standard",

    bleedingStacks: 2,

    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Causa dano leve-médio ao alvo e aplica ${this.bleedingStacks} stack(s) de Sangramento. Se o alvo já estiver sangrando, aplica +1 stack adicional.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainDamage = results[0];

      if (
        !mainDamage?.evaded &&
        !mainDamage?.immune &&
        (mainDamage?.totalDamage ?? 0) > 0
      ) {
        const bleedStacks = enemy.hasStatusEffect("bleeding")
          ? this.bleedingStacks + 1
          : this.bleedingStacks;
        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          bleedStacks,
        );
      }

      return results;
    },
  },

  {
    key: "hemorragia_dirigida",
    name: "Hemorragia Dirigida",
    bf: 55,
    damagePerBleedStack: 18,
    shieldBleedThreshold: 4,
    shieldFromTargetMaxHpRatio: 0.35,
    shieldDecayTurns: 3,
    contact: false,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Causa dano moderado. O dano aumenta em +${this.damagePerBleedStack}% para cada stack de Sangramento no alvo. Não consome Sangramento. Se atingir um alvo com ${this.shieldBleedThreshold}+ stacks de Sangramento, Drex ganha um escudo de ${Math.round(this.shieldFromTargetMaxHpRatio * 100)}% do HP máximo do alvo por ${this.shieldDecayTurns} turnos.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const bleedStacks =
        Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;
      const damageMultiplier =
        1 + (bleedStacks * this.damagePerBleedStack) / 100;
      const baseDamage = ((user.Attack * this.bf) / 100) * damageMultiplier;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainDamage = results[0];

      const dealtDamage = Number(mainDamage?.totalDamage ?? 0) > 0;
      const connected =
        !mainDamage?.evaded && !mainDamage?.immune && dealtDamage;

      if (connected && bleedStacks >= this.shieldBleedThreshold) {
        const shieldAmount = Math.floor(
          Number(enemy?.maxHP || 0) * this.shieldFromTargetMaxHpRatio,
        );

        if (shieldAmount > 0) {
          user.addShield(shieldAmount, 0, context, "regular", {
            expiresAtTurn: context.currentTurn + this.shieldDecayTurns,
            sourceKey: this.key,

            visualVariant: "drex_blood",
          });

          results.push({
            log: `${formatChampionName(user)} converte a hemorragia em proteção e recebe um escudo de ${shieldAmount} HP.`,
          });
        }
      }

      return results;
    },
  },

  {
    key: "eclipse_hemorragico",
    name: "Eclipse Hemorrágico",
    contact: false,
    isUltimate: true,
    ultCost: 3,
    priority: 1,
    targetSpec: ["all:enemy"],

    description() {
      return `Atinge todos os inimigos que estiverem com Sangramento. Cada stack é convertida em um impacto imediato de Sangramento, sem consumir o status.`;
    },

    resolve({ user, targets, context = {} }) {
      const bleedingTargets = targets.filter((enemy) =>
        enemy?.hasStatusEffect("bleeding"),
      );

      if (bleedingTargets.length === 0) {
        return {
          log: `${formatChampionName(user)} invoca o Eclipse Hemorrágico, mas nenhum inimigo está sangrando.`,
        };
      }

      const results = [];

      for (const enemy of bleedingTargets) {
        const bleedStacks =
          Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;
        const tickDamage = Math.floor(enemy.maxHP * 0.05);

        for (let index = 0; index < bleedStacks; index += 1) {
          const tickResult = new DamageEvent({
            baseDamage: tickDamage,
            attacker: user,
            defender: enemy,
            skill: { name: "Sangramento", key: "bleeding_tick" },
            type: "physical",
            mode: DamageEvent.Modes.ABSOLUTE,
            context: {
              ...context,
              isDot: true,
              allowsLifeSteal: true,
            },
            allChampions: context?.allChampions,
          }).execute();

          if (Array.isArray(tickResult)) results.push(...tickResult);
          else if (tickResult) results.push(tickResult);
        }
      }

      return results;
    },
  },
];

export default drexSkills;
