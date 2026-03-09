export function defenseToPercent(defense, debugMode) {
  if (debugMode) console.group(`🛡️ [DEFENSE DEBUG]`);

  if (!defense) {
    if (debugMode) {
      console.log(`Defense: ${defense} (ou 0)`);
      console.log(`Redução percentual: 0%`);
      console.groupEnd();
    }
    return 0;
  }

  // --- Constantes globais do modelo ---
  const BASE_DEF = 220;
  const BASE_REDUCTION = 0.75;
  const MAX_REDUCTION = 0.95;
  const K = 0.0045;

  // --- Curva base (até 150) ---
  const curve = {
    0: 0.0,
    35: 0.25,
    60: 0.4,
    85: 0.53,
    110: 0.6,
    150: 0.65,
    200: 0.72,
    220: 0.78,
  };

  const keys = Object.keys(curve)
    .map(Number)
    .sort((a, b) => a - b);

  let effective = 0;

  // ================================
  // Segmento 1 — interpolado
  // ================================
  if (defense <= BASE_DEF) {
    if (defense <= keys[0]) {
      effective = curve[keys[0]];
    } else {
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];

        if (defense >= a && defense <= b) {
          const t = (defense - a) / (b - a);
          effective = curve[a] + t * (curve[b] - curve[a]);
          break;
        }
      }
    }
  }
  // ================================
  // Segmento 2 — cauda assintótica
  // ================================
  else {
    effective =
      BASE_REDUCTION +
      (MAX_REDUCTION - BASE_REDUCTION) *
        (1 - Math.exp(-K * (defense - BASE_DEF)));
  }

  // Segurança numérica
  effective = Math.min(effective, MAX_REDUCTION);

  if (debugMode) {
    console.log(`Defense original: ${defense}`);
    console.log(`Redução interpolada: ${(effective * 100).toFixed(2)}%`);
    console.log(`Dano que PASSA: ${((1 - effective) * 100).toFixed(2)}%`);
    console.groupEnd();
  }

  return effective;
}
