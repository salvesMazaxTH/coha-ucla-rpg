export default {
  name: "Sede de Sangue",
  description:
    "Cada acerto crítico aumenta a chance de crítico em +15% (máx. 95%). Quando a chance de crítico ultrapassa 50%, o bônus de crítico sobe para 1,85x.",
  onCriticalHit({ user, target, context }) {
    user.modifyStat({
      statName: "Critical",
      amount: 15,
      context,
      isPermanent: true,
    });
    if (user.Critical > 50) {
      user.critBonusOverride = 85;
    }
    console.log(
      `${user.name} ganhou +15% Critical por causa de Sede de Sangue! Critical atual: ${user.Critical}%` +
        (user.critBonusOverride === 85 ? ` | Bônus de crítico: 1.85x` : ``),
    );
  },
};
