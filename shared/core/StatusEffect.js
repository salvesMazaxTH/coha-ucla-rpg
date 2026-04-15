export class StatusEffect {
  constructor({ key, duration, owner, context, metadata = {}, hooks = {} }) {
    this.key = key;

    this.ownerId = owner?.id ?? null;

    this.appliedAtTurn = context?.currentTurn ?? 0;
    this.expiresAtTurn = this.appliedAtTurn + duration;

    this.metadata = metadata;
    Object.assign(this, metadata);

    // Inject hook functions directly into the instance
    Object.assign(this, hooks);
  }
}
