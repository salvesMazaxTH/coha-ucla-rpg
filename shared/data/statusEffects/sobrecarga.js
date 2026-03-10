const sobrecarga = {
  key: "sobrecarga",
  name: "Sobrecarga",
  type: "debuff",

onAfterDmgTaking({ target, damage, context, skill }) {
    if (skill.element !== "electric") return;

    damage = Math.round(damage * 1.2);

    return damage;

}
};

export default sobrecarga;
