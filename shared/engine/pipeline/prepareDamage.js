import { applyAffinity } from "../systems/affinitySystem.js";
import { processCrit } from "../systems/critSystem.js";
import { applyDamageModifiers } from "../systems/modifierSystem.js";

export function prepareDamage(event) {
  if (event.mode === event.constructor.Modes.ABSOLUTE) return;
  const debug = event.constructor.debugMode;
  // ordem importa
  // crit -> modifiers -> affinity
  processCrit(event, debug);

  applyDamageModifiers(event, debug);

  applyAffinity(event, debug);
}
