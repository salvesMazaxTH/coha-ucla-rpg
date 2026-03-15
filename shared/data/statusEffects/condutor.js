const condutor = {
  key: "condutor",
  name: "Condutor",
  type: "debuff",
  subtypes: ["damageMod", "lightning"],

  hookScope: {
    onAfterDmgTaking: "target",
  },

  onAfterDmgTaking({ target, damage, context, skill }) {
    if (skill.element !== "lightning") return;

    damage = Math.round(damage * 1.2);

    return damage;
  },
};

export default condutor;
