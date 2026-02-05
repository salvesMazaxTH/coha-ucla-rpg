export function isSkillOnCooldown(user, skill, currentTurn) {
  if (!skill.cooldown || skill.cooldown <= 0) return null;

  const entry = user.cooldowns.get(skill.key);
  if (!entry) return null;

  if (currentTurn < entry.availableAt) {
    return entry;
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
  editMode,
}) {
  if (editMode) return null;

  const cooldownInfo = isSkillOnCooldown(user, skill, currentTurn);
  if (!cooldownInfo) return null;

  const { isUltimateLock, availableAt } = cooldownInfo;

  return {
    message: isUltimateLock
      ? `${skill.name} é uma Ultimate e está bloqueada no início da partida.`
      : `${skill.name} está em cooldown. Retorna no turno ${availableAt}.`,
    isUltimateLock,
    availableAt,
  };
}
