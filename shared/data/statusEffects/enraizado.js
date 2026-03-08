const enraizado = {
  key: "enraizado",
  name: "Enraizado",
  type: "debuff",
  subtypes: ["cc", "softCC"],

  onValidateAction({ user, skill }) {
    if (!skill?.contact) return;

    const skillName = skill?.name || "habilidade";

    return {
      deny: true,
      message: `${user.name} está Enraizado e não pode usar a habilidade de contato "${skillName}"!`,
    };
  },
};

export default enraizado;
