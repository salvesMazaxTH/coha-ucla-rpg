const atordoado = {
  key: "atordoado",
  name: "Atordoado",
  type: "debuff",
  subtypes: ["hardCC"],

  hookScope: {
    onValidateAction: "source",
  },

  onValidateAction({ source }) {
    return {
      deny: true,
      message: `${source.name} está Atordoado e não pode agir!`,
    };
  },
};

export default atordoado;
