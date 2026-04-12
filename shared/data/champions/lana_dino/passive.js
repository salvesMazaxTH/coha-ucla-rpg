export default {
  key: "instinto_selvagem",
  name: "Instinto Selvagem",

  description() {
    return `Quando Tutu é derrotado, Lana retorna ao combate com o mesmo HP que tinha ao sair.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ owner, context }) {
    // se ainda estiver vivo, não faz nada
    if (owner.HP > 0) return;

    const storedHP = owner.runtime.lana?.storedHP;
    const lanaOriginalId = owner.runtime.lana?.originalId;

    if (!storedHP || !lanaOriginalId) {
      // Lana não teve HP armazenado ou ID original (situação anormal)
      return;
    }

    if (!context)
      throw new Error(
        `[instinto_selvagem] ERRO: context é undefined ao tentar registrar replaceRequest em ${owner.name}`,
      );

    // Registra intenção de restore (Tutu → Lana)
    context.flags ??= {};
    context.flags.replaceRequests ??= [];

    context.flags.replaceRequests.push({
      mode: "restore",
      targetId: lanaOriginalId,
      preserveOriginalId: lanaOriginalId,
      overrideHP: storedHP,
    });

    return {
      log: `${owner.name} foi derrotado! Lana retorna ao combate!`,
    };
  },
};

