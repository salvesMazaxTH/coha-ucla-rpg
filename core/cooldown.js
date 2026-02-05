export function isSkillOnCooldown(user, skill, currentTurn) {
  if (!skill.cooldown || skill.cooldown <= 0) return null;

  const entry = user.cooldowns.get(skill.key);
  if (!entry) return null;

  if (currentTurn < entry.availableAt) {
    return {
      availableAt: entry.availableAt,
    };
  }

  // cooldown acabou
  user.cooldowns.delete(skill.key);
  return null;
}


export function startCooldown(user, skill, currentTurn) {
  if (!skill.cooldown || skill.cooldown <= 0) return;

  const availableAt = currentTurn + skill.cooldown + 1;

  user.cooldowns.set(skill.key, {
    availableAt,
    duration: skill.cooldown,
  });
  console.log(
    `[COOLDOWN] ${skill.name} usado no turno ${currentTurn}, disponível no ${availableAt}`,
  );
}

export function checkAndValidateCooldowns({
  user,
  skill,
  currentTurn,
  editMode
}) {
  if (editMode) return null;

  const cooldownInfo = isSkillOnCooldown(user, skill, currentTurn);

  if (!cooldownInfo) return null;

  return {
    message: `Habilidade ${skill.name} está em cooldown. Retorna no turno ${cooldownInfo.availableAt}.`,
    availableAt: cooldownInfo.availableAt,
  };
}