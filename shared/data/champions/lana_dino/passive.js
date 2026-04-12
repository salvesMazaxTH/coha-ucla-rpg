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

    const lanaOriginalId = owner.runtime.lana?.originalId;

    if (!lanaOriginalId) {
      // Sem ID original armazenado (situação anormal — Lana nunca foi swapped out)
      return;
    }

    if (!context)
      throw new Error(
        `[instinto_selvagem] ERRO: context é undefined ao tentar registrar replaceRequest em ${owner.name}`,
      );

    // Registra intenção de restore (Tutu → Lana)
    // Estado completo de Lana (incluindo HP original) será restaurado automaticamente
    context.flags ??= {};
    context.flags.replaceRequests ??= [];

    context.flags.replaceRequests.push({
      mode: "restore",
      targetId: lanaOriginalId,
    });

    return {
      log: `${owner.name} foi derrotado! Lana retorna ao combate!`,
    };
  },
};
