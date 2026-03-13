const paralisado = {
  key: "paralisado",
  name: "Paralisado",
  isHardCC: true,
  
  hookScope: {
  onValidateAction: "owner"
},

  onValidateAction({ source }) {
    return {
      deny: true,
      message: `${source.name} está Paralisado e não pode agir!`,
    };
  },
};

export default paralisado;
