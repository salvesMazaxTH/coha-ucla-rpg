const K = 75; // Constante de balanceamento para a fórmula de redução de dano

for (let defense = 0; defense <= 150; defense += 5) {
  let adjusted = defense;
  if (defense < 35) {
    adjusted *= 0.735;
  } else if (defense >= 35 && defense < 85) {
    adjusted *= 1.15;
  } else if (defense >= 85) {
    adjusted *= 1.35;
  }
  const effective = adjusted / (adjusted + K);
  console.log(
    `Defense: ${defense}, Effective: ${(effective * 100).toFixed(2)}%`,
  );
}
