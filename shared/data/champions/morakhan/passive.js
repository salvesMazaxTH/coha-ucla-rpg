import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "primeiro_sutra_coracao_adamantino",
  name: "Primeiro Sutra: Coração Adamantino",

  flatReductionVSContact: 25,
  stabilityStacksCap: 4,

  description(champion) {
    const stacks = champion.runtime?.stabilityStacks || 0;

    return `Morakhan reduz o dano sofrido em 10% (exceto dano absoluto). Contra ataques de contato, também reduz ${this.flatReductionVSContact} de dano adicional.
    Sempre que sofre dano de contato, ganha 1 acúmulo de <b>Estabilidade</b> (máx. ${this.stabilityStacksCap}).

    Ao sofrer dano, se estiver com acúmulos ou for atingido por um golpe significativo, consome todos os acúmulos, reduzindo o dano em 10% por acúmulo.

    <b>Acúmulos atuais: ${stacks}</b>`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  onBeforeDmgTaking({ damage, skill, context, owner, defender }) {
    const isContact = skill?.contact;
    const stacks = owner.runtime?.stabilityStacks || 0;

    let finalDamage = damage;

    if (isContact)
      finalDamage = Math.max(0, finalDamage - this.flatReductionVSContact);

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

    const msg = `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} consumiu ${stacks} acúmulo(s) de Estabilidade!`;

    context.registerDialog?.({
      message: msg,
      sourceId: owner.id,
      targetId: defender.id,
    });

    return { damage: finalDamage, log: msg };
  },

  onAfterDmgTaking({ damage, skill, owner }) {
    if (damage <= 0 || !skill?.contact) return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) return;

    runtime.stabilityStacks = stacks + 1;

    return {
      log: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} ganha 1 acúmulo de Estabilidade (${runtime.stabilityStacks}/${this.stabilityStacksCap}).`,
    };
  },
};
