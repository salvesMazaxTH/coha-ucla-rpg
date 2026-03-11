const paralisado = {
  key: "paralisado",
  name: "Paralisado",
  isHardCC: true,
  
  hookScope: {
  onValidateAction: "owner"
},

  onValidateAction({ user }) {
    return {
      deny: true,
      message: `${user.name} está Paralisado e não pode agir!`,
    };
  },
};

export default paralisado;
