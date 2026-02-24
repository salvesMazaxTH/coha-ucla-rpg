// shared/champions/barao_estrondoso/passive.js

export default {
  key: "reator_cataclismico",
  name: "Reator Cataclísmico",
  storageBasePercent: 30,
  storageShieldPercent: 40,
  storageCap: 250,
  description(champion) {
    const stored = champion.runtime?.storedDamage || 0;

    return `
    O Barão converte dano recebido em energia destrutiva.

    Recebe +${this.damageTakenBonusPercent}% de dano adicional (mín. +${this.damageTakenBonusFlatMin}).

    Armazena ${this.storageBasePercent}% do dano sofrido (máx. ${this.storageCap}). Com Blindagem Reforçada, armazena ${this.storageShieldPercent}% em vez disso.

    ${stored > 0 ? `Dano armazenado: ${stored}` : ""}

    Sobrecarga do Reator:
    Após usar uma habilidade (exceto Ataque Básico), fica Atordoado no próximo turno.

    Explosão Final:
    Ao usar a Ultimate, causa dano adicional igual ao total armazenado e zera o acúmulo.`;
  },

  // 🔴 Recebe 10% de dano adicional (mínimo +10)
  onBeforeDmgTaking({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    const bonus = Math.max(10, Math.floor(damage * 0.1));
    const modifiedDamage = damage + bonus;

    return {
      damage: modifiedDamage,
    };
  },

  // 🔴 Armazena dano recebido (30% ou 40% se blindado)
  onAfterDmgTaking({ dmgSrc, dmgReceiver, owner, damage, context }) {
    if (owner?.id !== dmgReceiver?.id) return;
    if (!damage || damage <= 0) return;

    console.log(
      `[${owner.name} - Reator Cataclísmico] Dano recebido: ${damage}`,
    );

    const storageRate = owner.hasKeyword?.("blindagem_reforcada") ? 0.4 : 0.3;

    const stored = Math.floor(damage * storageRate);

    console.log(
      `[${owner.name} - Reator Cataclísmico] Dano armazenado: ${stored} (Taxa: ${storageRate * 100}%)`,
    );

    owner.runtime = owner.runtime || {};
    owner.runtime.storedDamage = Math.min(
      250,
      (owner.runtime.storedDamage || 0) + stored,
    );
    console.log(
      `[${owner.name} - Reator Cataclísmico] Dano armazenado total: ${owner.runtime.storedDamage}`,
    );
  },

  // 🔴 Após usar qualquer habilidade (exceto ataque básico), fica Atordoado
  onAfterDmgDealing({ dmgSrc, dmgReceiver, owner, damage, context, skill }) {
    if (!skill?.key) return;

    if (dmgSrc !== owner) return;

    // Ataque básico não causa stun
    if (skill.key === "basic_attack") return;

    // Evita loop se alguma skill futura aplicar stun interno
    if (owner.hasKeyword?.("atordoado")) return;

    owner.applyKeyword?.("atordoado", 1, context);

    return {
      log: `${owner.name} sofreu sobrecarga do núcleo e ficará Atordoado!`,
    };
  },
};
