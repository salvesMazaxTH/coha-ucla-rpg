// shared/champions/barao_estrondoso/passive.js

export default {
  key: "reator_cataclismico",
  name: "Reator Cataclísmico",
  storageBasePercent: 30,
  storageShieldPercent: 40,
  storageCap: 250,
  description() {
    return `
    O núcleo do Barão absorve impactos para alimentar seu canhão nuclear.

    • Recebe +10% de dano adicional de todas as fontes (mínimo +10).
    • Armazena ${this.storageBasePercent || 30}% do dano recebido (máx. ${this.storageCap || 250}).
    • Enquanto "Blindagem Reforçada" estiver ativa, armazena ${this.storageShieldPercent || 40}% em vez disso.

    Sobrecarga do Reator:
    Após usar qualquer habilidade (exceto Ataque Básico), o Barão ficará "Atordoado" no turno seguinte.

    Explosão Final:
    Ao usar sua Ult, todo o dano armazenado é adicionado ao golpe e o armazenamento é zerado.`;
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

    const storageRate = owner.hasKeyword?.("blindagem_reforcada") ? 0.4 : 0.3;

    const stored = Math.floor(damage * storageRate);

    owner.runtime = owner.runtime || {};
    owner.runtime.storedDamage = Math.min(
      250,
      (owner.runtime.storedDamage || 0) + stored,
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
