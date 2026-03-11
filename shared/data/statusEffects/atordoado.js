const atordoado = {
  key: "atordoado",
  name: "Atordoado",
  type: "debuff",
  subtypes: ["cc", "hardCC"],

  hookScope: {
    onValidateAction: "owner",
  },

  onValidateAction({ user }) {
    return {
      deny: true,
      message: `${user.name} está Atordoado e não pode agir!`,
    };
  },
};

export default atordoado;
