import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "primeiro_sutra_coracao_adamantino",
  name: "Primeiro Sutra: Coração Adamantino",

  flatReductionVSContact: 25, // Mantém para referência, mas não mais usado para trigger
  stabilityStacksCap: 4,
  dmgBuffAuraDuration: 2,

  description(champion) {
    const stacks = champion.runtime?.stabilityStacks || 0;

    return `Morakhan reduz dano sofrido em 10% (exceto dano absoluto) e reduz ${this.flatReductionVSContact} de dano adicional de ataques físicos.

    Sempre que sofre dano físico, ganha 1 acúmulo de <b>Estabilidade</b> (máx. ${this.stabilityStacksCap}).

    Ao sofrer um golpe significativo, consome todos os acúmulos para reduzir o dano recebido em 10% por acúmulo e fortalece seus próximos danos por ${this.dmgBuffAuraDuration} turno(s).

    <b>Acúmulos atuais: ${stacks}</b>`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  onBeforeDmgTaking({ damage, skill, context, owner, defender, type }) {
    // type: "physical" | "magical" | ...
    const isPhysical = type === "physical";
    const stacks = owner.runtime?.stabilityStacks || 0;

    let finalDamage = damage;

    if (isPhysical)
      finalDamage = Math.max(5, finalDamage - this.flatReductionVSContact); // 5 para respeitar o piso mínimo global

    finalDamage *= 0.9;

    // 🔹 avaliação de golpe significativo
    const hp = owner.HP;
    const nextHp = hp - damage;
    const halfHp = owner.maxHP * 0.5;

    const isSignificantHit =
      (hp > halfHp && nextHp < halfHp) || (hp <= halfHp && nextHp <= 0);

    if (!stacks || !isSignificantHit) return { damage: finalDamage };

    finalDamage *= 1 - 0.1 * stacks;
    owner.runtime.stabilityStacks = 0;

    const runtime = (owner.runtime ??= {});
    runtime.hookEffects ??= [];
    runtime.hookEffects = runtime.hookEffects.filter(
      (effect) => effect.key !== "morakhan_estabilidade_adamantina_burst",
    );
    runtime.hookEffects.push({
      key: "morakhan_estabilidade_adamantina_burst",
      name: "Estabilidade Adamantina Amplificada",
      expiresAtTurn: context.currentTurn + 2,
      hookScope: {
        onBeforeDmgDealing: "attacker",
      },
      hookPolicies: {
        onBeforeDmgDealing: {
          allowOnDot: true,
          allowOnNestedDamage: true,
        },
      },
      onBeforeDmgDealing({ damage, attacker, skill }) {
        return {
          damage: damage * 2,
          log: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(attacker)} duplica o dano causado${skill?.key === "quarto_sutra_postura_da_montanha_counter" ? " pelo contra-ataque" : ""}!`,
        };
      },
    });

    const msg = `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} consumiu ${stacks} acúmulo(s) de Estabilidade!`;

    context.registerDialog?.({
      message: msg,
      sourceId: owner.id,
      targetId: defender.id,
    });

    return { damage: finalDamage, log: msg };
  },

  onAfterDmgTaking({ damage, skill, owner, type }) {
    // type: "physical" | "magical" | ...
    if (damage <= 0 || type !== "physical") return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) return;

    runtime.stabilityStacks = stacks + 1;

    return {
      log: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} ganha 1 acúmulo de Estabilidade (${runtime.stabilityStacks}/${this.stabilityStacksCap}).`,
    };
  },
};
