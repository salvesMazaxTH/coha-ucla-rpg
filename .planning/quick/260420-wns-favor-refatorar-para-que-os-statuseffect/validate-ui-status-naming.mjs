import { StatusIndicator } from "../../../shared/ui/statusIndicator.js";
import { GAME_GLOSSARY } from "../../../public/js/gameGlossary.js";

const expectedIndicatorKeys = [
  "paralyzed",
  "stunned",
  "rooted",
  "inert",
  "chilled",
  "frozen",
  "burning",
  "bleeding",
  "absoluteimmunity",
  "conductor",
];

const missingIndicatorKeys = expectedIndicatorKeys.filter(
  (key) => !(key in StatusIndicator.statusEffectIcons),
);
if (missingIndicatorKeys.length > 0) {
  throw new Error(`Missing indicator keys: ${missingIndicatorKeys.join(", ")}`);
}

const labels = expectedIndicatorKeys.map(
  (key) => StatusIndicator.statusEffectIcons[key].label,
);
const expectedLabels = [
  "Paralisado",
  "Congelado",
  "Imunidade Absoluta",
  "Sangramento",
];
const missingLabels = expectedLabels.filter((label) => !labels.includes(label));
if (missingLabels.length > 0) {
  throw new Error(`Missing Portuguese UI labels: ${missingLabels.join(", ")}`);
}

const expectedGlossaryKeys = [
  "atordoado",
  "condutor",
  "congelado",
  "enraizado",
  "gelado",
  "inerte",
  "invisivel",
  "paralisado",
  "queimando",
  "sangramento",
];
const missingGlossaryKeys = expectedGlossaryKeys.filter(
  (key) => !(key in GAME_GLOSSARY),
);
if (missingGlossaryKeys.length > 0) {
  throw new Error(
    `Missing glossary PT keys: ${missingGlossaryKeys.join(", ")}`,
  );
}

console.log("indicator-keys-english-ok");
console.log("ui-labels-portuguese-ok");
console.log("glossary-portuguese-ok");
