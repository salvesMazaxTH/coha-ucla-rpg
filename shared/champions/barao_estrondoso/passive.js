// shared/champions/barao_estrondoso/passive.js

export default {
  key: "reator_cataclismico",
  name: "Reator Cataclísmico",
  storageBasePercent: 30,
  storageShieldPercent: 40,
  damageTakenBonusPercent: 10,
  damageTakenBonusFlatMin: 10,
  storageCap: 250,
  description(champion) {
    const stored = champion.runtime?.storedDamage || 0;

    return `
    O Barão converte dano recebido em energia destrutiva.

    Recebe +${this.damageTakenBonusPercent}% de dano adicional (não vale para dano absoluto e DoT).

    Armazena ${this.storageBasePercent}% do dano sofrido (máx. ${this.storageCap}). Com Blindagem Reforçada, armazena ${this.storageShieldPercent}% em vez disso.

   Dano armazenado: <b>${stored > 0 ? stored : 0}</b>

    Sobrecarga do Reator:
    Após usar uma habilidade (exceto Ataque Básico), fica Atordoado no próximo turno.

    Explosão Final:
    Ao usar a Ultimate, causa dano adicional igual ao total armazenado e zera o acúmulo.`;
  },

  hookScope: {
    onAfterDmgTaking: "self",
    onAfterDmgDealing: "source",
  },

  // 🔴 Recebe 10% de dano adicional (mínimo +10)
  onBeforeDmgTaking({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    const bonus = Math.max(
      this.damageTakenBonusFlatMin,
      Math.floor(damage * (this.damageTakenBonusPercent / 100)),
    );
    const modifiedDamage = damage + bonus;

    return {
      damage: modifiedDamage,
    };
  },

  // 🔴 Armazena dano recebido (30% ou 40% se blindado)
  onAfterDmgTaking({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    console.log(
      `[${owner.name} - Reator Cataclísmico] Dano recebido: ${damage}`,
    );

    const storageRate = owner.hasStatusEffect?.("blindagem_reforcada")
      ? this.storageShieldPercent / 100
      : this.storageBasePercent / 100;

    const stored = Math.floor(damage * storageRate);

    console.log(
      `[${owner.name} - Reator Cataclísmico] Dano armazenado: ${stored} (Taxa: ${storageRate * 100}%)`,
    );

    owner.runtime = owner.runtime || {};
    owner.runtime.storedDamage = Math.min(
      this.storageCap,
      (owner.runtime.storedDamage || 0) + stored,
    );
    console.log(
      `[${owner.name} - Reator Cataclísmico] Dano armazenado total: ${owner.runtime.storedDamage}`,
    );
  },

  // 🔴 Após usar qualquer habilidade (exceto ataque básico), fica Atordoado
  onAfterDmgDealing({ dmgSrc, dmgReceiver, owner, damage, context, skill }) {
    if (!skill?.key) return;

    // Ataque básico não causa stun
    if (skill.key === "basic_attack") return;

    // Evita loop se alguma skill futura aplicar stun interno
    if (owner.hasStatusEffect?.("atordoado")) return;

    owner.applyStatusEffect?.("atordoado", 2, context);

    return {
      log: `${owner.name} sofreu sobrecarga do núcleo e ficará Atordoado!`,
    };
  },
};
