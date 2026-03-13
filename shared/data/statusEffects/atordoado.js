const atordoado = {
  key: "atordoado",
  name: "Atordoado",
  type: "debuff",
  subtypes: ["cc", "hardCC"],

  hookScope: {
    onValidateAction: "owner",
  },

  onValidateAction({ source }) {
    return {
      deny: true,
      message: `${source.name} está Atordoado e não pode agir!`,
    };
  },
};

export default atordoado;
