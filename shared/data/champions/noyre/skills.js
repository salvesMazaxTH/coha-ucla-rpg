import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const noyreSkills = [
  // ========================
  // Disparo Básico (global)
  // ========================
  basicShot,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "distorcao_entropica",
    name: "Distorção Entrópica",
    damageMode: "standard",
    bf: 65,
    priority: 1,
    dmgBonus: 40,
    description() {
      return `Reduz o ultômetro do alvo em 2 unidades. Se o alvo tiver 3 barras ou mais de ult, causa ${this.dmgBonus}% a mais de dano.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context, resolver }) {
      const [target] = targets;
      // 🔹 checar condição (3 barras = 12 unidades)
      const hasHighUlt = target.ultMeter >= 12;
      const damage = hasHighUlt
        ? Math.floor(
            ((user.Attack * this.bf) / 100) * (1 + this.dmgBonus / 100),
          )
        : Math.floor((user.Attack * this.bf) / 100);
      new DamageEvent({
        baseDamage: damage,
        attacker: user,
        defender: target,
        skill: this,
        context,
        allChampions: context.allChampions,
      }).execute();
      // 🔹 reduzir ult
      resolver.applyResourceChange({
        target,
        amount: -2,
        context,
        sourceId: user.id,
        emitHooks: false,
      });
      return {
        log: hasHighUlt
          ? `${user.name} distorceu a energia de ${target.name} (dano amplificado).`
          : `${user.name} distorceu a energia de ${target.name}.`,
      };
    },
  },
  {
    key: "silencio_energetico",
    name: "Silêncio Energético",
    priority: 2,
    duration: 2,
    allyShieldPercent: 10,
    description() {
      return `Todos os outros campeões não podem ganhar ultômetro por ${this.duration} turnos. Aliados afetados recebem escudo de ${this.allyShieldPercent}% do HP máximo quando tiverem ganho de ultômetro anulado.`;
    },
    targetSpec: ["all"],
    resolve({ user, targets, context, resolver }) {
      const allyShieldPercent = this.allyShieldPercent;
      const affected = targets.filter(
        (champ) => champ.id !== user.id && champ.alive,
      );

      for (const target of affected) {
        target.runtime.hookEffects ??= [];

        const hookKey = `silencio_energetico_${user.id}_${target.id}`;

        target.runtime.hookEffects = target.runtime.hookEffects.filter(
          (hook) => hook.key !== hookKey,
        );

        target.runtime.hookEffects.push({
          key: hookKey,
          group: "skill_effect",
          expiresAtTurn: context.currentTurn + this.duration,
          hookScope: {
            onResourceGain: "target",
          },
          onResourceGain({ owner, amount, resolver, context, target }) {
            if (amount <= 0) return;
            if (!owner || owner.id !== target.id) return;

            resolver.applyResourceChange({
              target: owner,
              amount: -amount,
              context,
              sourceId: user.id,
              emitHooks: false,
            });

            if (owner.team === user.team) {
              const shieldAmount = Math.floor(
                owner.maxHP * (allyShieldPercent / 100),
              );
              owner.addShield(shieldAmount, 0, context);

              return {
                log: `${formatChampionName(owner)} teve seu ganho de ultômetro anulado e recebeu ${shieldAmount} de escudo!`,
              };
            }

            return {
              log: `${formatChampionName(owner)} teve seu ganho de ultômetro anulado!`,
            };
          },
        });
      }

      return {
        log: `${user.name} anulou o ganho de ultômetro de todos os outros campeões por ${this.duration} turnos!`,
      };
    },
  },
];

export default noyreSkills;
