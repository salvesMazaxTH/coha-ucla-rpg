export class Action {
  constructor({ userId, skillKey, targetIds }) {
    this.userId = userId;
    this.skillKey = skillKey;
    this.targetIds = targetIds;
  }

  getUser(match) {
    return match.getChampion(this.userId);
  }

  getSkill(match) {
    const user = this.getUser(match);
    if (!user) return null;
    return user.skills.find((s) => s.key === this.skillKey);
  }

  getPriority(match) {
    const skill = this.getSkill(match);
    return skill?.priority ?? 0;
  }

  getSpeed(match) {
    const user = this.getUser(match);
    return user?.Speed ?? 0;
  }
}
