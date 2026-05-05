import { createStackBoundDotStatusEffect } from "./stackBoundDot.js";

const bleeding = createStackBoundDotStatusEffect({
  key: "bleeding",
  name: "Sangramento",
  logName: "Sangramento",
  immuneLabel: "Sangramento",
  damageType: "physical",
  tickKey: "bleeding_tick",
  subtypes: ["dot", "physical"],
});

export default bleeding;
