const enraizado = {
  key: "enraizado",
  name: "Enraizado",
  type: "debuff",
  subtypes: ["softCC"],

  hookScope: {
    onValidateAction: "owner",
  },

  onValidateAction({ source, skill }) {
    if (!skill?.contact) return;

    const skillName = skill?.name || "habilidade";

    return {
      deny: true,
      message: `${source.name} está Enraizado e não pode usar a habilidade de contato "${skillName}"!`,
    };
  },
};

export default enraizado;
