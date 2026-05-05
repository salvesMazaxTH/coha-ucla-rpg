import { createStackBoundDotStatusEffect } from "./stackBoundDot.js";

const poisoned = createStackBoundDotStatusEffect({
  key: "poisoned",
  name: "Envenenado",
  logName: "Envenenamento",
  immuneLabel: "Envenenamento",
  damageType: "magical",
  tickKey: "poisoned_tick",
  subtypes: ["dot", "magical"],
  formatOwnerName: false,
});

export default poisoned;
