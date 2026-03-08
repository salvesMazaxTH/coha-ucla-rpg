const imunidadeAbsoluta = {
  key: "imunidadeAbsoluta",
  name: "Imunidade Absoluta",
  type: "buff",
  subtypes: ["immunity"],

  onDamageIncoming({ dmgReceiver }) {
    return {
      cancel: true,
      immune: true,
      message: `${dmgReceiver.name} é imune a dano!`,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;

    return {
      cancel: true,
      message: `${target.name} é imune a efeitos negativos!`,
    };
  },
};

export default imunidadeAbsoluta;
