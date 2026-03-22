// ============================================================================
// DEFENSE SYSTEM
// ============================================================================

function defenseToPercent(defense, debugMode) {
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

// ============================================================================
// MAIN PIPELINE STEP
// ============================================================================

export function composeDamage(event) {
  if (event.constructor.debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);

  if (typeof event.damage !== "number") {
    throw new Error(`composeDamage recebeu damage inválido: ${event.damage}`);
  }

  // 1. Tira a foto do dano máximo alcançado antes do alvo se defender
  event.preMitigationDamage = event.damage;
  console.log(`📸 Dano pré-mitigação: ${event.preMitigationDamage.toFixed(2)}`);

  event.crit ??= { didCrit: false, critExtra: 0 };

  // ---------------- ABSOLUTE ----------------
  if (event.mode === event.constructor.Modes.ABSOLUTE) {
    // dano absoluto ignora tudo: defesa, crítico, modificadores, afinidade, etc

    if (event.constructor.debugMode) {
      console.log("⚡ ABSOLUTE DAMAGE");
      console.log("➡️ ignora crítico, defesa e reduções");
      console.log(`📈 Final: ${event.damage.toFixed(2)}`);
      console.groupEnd();
    }

    return;
  }

  // aplica crítico
  if (event.crit.didCrit) {
    event.damage += event.crit.critExtra;
  }

  const baseDefense = event.defender.baseDefense ?? event.defender.Defense;
  const currentDefense = event.defender.Defense;

  const defenseUsed = event.crit.didCrit
    ? Math.min(baseDefense, currentDefense)
    : currentDefense;

  const defensePercent = defenseToPercent(
    defenseUsed,
    event.constructor.debugMode,
  );

  const { flat, percent } = event.defender.getTotalDamageReduction?.() || {
    flat: 0,
    percent: 0,
  };

  // ---------------- STANDARD ----------------
  if (
    event.mode === event.constructor.Modes.STANDARD ||
    event.piercingPortion <= 0
  ) {
    const debug = event.constructor.debugMode;

    if (debug) {
      console.log(`[DAMAGE COMPOSITION] 📸 Base damage: ${event.damage}`);
    }

    // Defesa
    const defenseMitigation = event.damage * defensePercent;
    event.damage = event.damage - defenseMitigation;

    if (debug) {
      console.log(
        `[DAMAGE COMPOSITION] 🛡️ Após defesa (${(defensePercent * 100).toFixed(
          1,
        )}%): ${event.damage.toFixed(2)}`,
      );
    }

    // Redução percentual
    event.damage *= 1 - percent / 100;

    if (debug) {
      console.log(
        `[DAMAGE COMPOSITION] 📉 Após redução percentual (${percent}%): ${event.damage.toFixed(2)}`,
      );
    }

    // Redução flat
    event.damage = event.damage - flat;

    if (debug) {
      console.log(
        `[DAMAGE COMPOSITION] 🧱 Após redução flat (${flat}): ${event.damage.toFixed(2)}`,
      );
    }
  }

  // ------------ PIERCING / HYBRID ------------
  else if (event.piercingPortion > 0) {
    const piercing = Math.min(event.piercingPortion, event.damage);
    const standard = event.damage - piercing;

    let standardAfter =
      (standard - standard * defensePercent - flat) * (1 - percent / 100);

    let piercingAfter = piercing - flat; // redução flat afeta o dano perfurante, mas não a redução percentual

    standardAfter = standardAfter < 0 ? 0 : standardAfter;
    piercingAfter = piercingAfter < 0 ? 0 : piercingAfter;

    event.damage = standardAfter + piercingAfter;
  }

  // -------- FLOOR --------
  if (!event.context?.ignoreMinimumFloor) {
    event.damage = Math.max(event.damage, 5);
  }

  event.damage = Math.min(event.damage, event.constructor.GLOBAL_DMG_CAP);

  // 2. Tira a foto do dano matemático final, pronto para ser aplicado

  const damageOverride = event.context?.editMode?.damageOutput;
  console.log(
    `📸 [DAMAGE COMPOSITION] Dano final calculado (antes de overrides): ${event.damage.toFixed(2)}`,
  );

  if (damageOverride != null) {
    event.damage = damageOverride;
    console.log(
      `⚡ [DAMAGE COMPOSITION] Override de dano ativado! Dano forçado para: ${event.damage.toFixed(2)}`,
    );
    if (event.constructor.debugMode) console.groupEnd();
  }

  event.finalDamage = event.damage;

  if (event.constructor.debugMode) {
    console.log(`[DAMAGE COMPOSITION] 📈 Final: ${event.finalDamage.toFixed(2)}`);
    console.groupEnd();
  }
}
