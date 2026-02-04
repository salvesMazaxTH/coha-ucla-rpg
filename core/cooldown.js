export function isSkillOnCooldown(user, skill, currentTurn) {
  // 🔥 Ultimate começa travada
  const isUlt = user?.skills && user.skills[user.skills.length - 1] === skill;

  if (isUlt && currentTurn < skill.cooldown) {
    return {
      type: "ultimate-lock",
      availableAt: skill.cooldown,
    };
  }

  const entry = user.cooldowns.get(skill.key);
  if (!entry) return null;

  return {
    type: "cooldown",
    availableAt: entry.availableAt,
  };
}

export function startCooldown(user, skill, currentTurn) {
  if (!skill.cooldown || skill.cooldown <= 0) return;

  const availableAt = currentTurn + skill.cooldown + 1;

  user.cooldowns.set(skill.key, {
    availableAt,
    duration: skill.cooldown,
  });
}
