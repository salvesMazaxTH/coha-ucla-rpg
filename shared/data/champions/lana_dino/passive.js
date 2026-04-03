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
    if (!storedHP) return; // Lana não teve HP armazenado (morreu antes da substituição)

    if (!context)
      throw new Error(
        `[instinto_selvagem] ERRO: context é undefined ao tentar registrar replaceRequest em ${owner.name}`,
      );

    // NÃO executa, só registra intenção
    context.flags ??= {};
    context.flags.replaceRequests ??= [];

    context.flags.replaceRequests.push({
      targetId: owner.id,
      newChampionKey: "lana",
      preserveRuntime: true,
      overrideHP: storedHP,
    });

    return {
      log: `${owner.name} foi derrotado! Lana retorna ao combate!`,
    };
  },
};
