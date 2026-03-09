import { defenseToPercent } from "../systems/defenseSystem.js";

export function composeDamage(event) {
  if (event.constructor.debugMode) console.group(`⚙️ [DAMAGE COMPOSITION]`);
  // 1. Tira a foto do dano máximo alcançado antes do alvo se defender
  event.preMitigationDamage = event.damage;
  console.log(`📸 Dano pré-mitigação: ${event.preMitigationDamage}`);

  event.crit ??= { didCrit: false, critExtra: 0 };

  // ---------------- ABSOLUTE ----------------
  if (event.mode === event.constructor.Modes.ABSOLUTE) {
    // dano absoluto ignora tudo: defesa, crítico, modificadores, afinidade, etc

    if (event.constructor.debugMode) {
      console.log("⚡ ABSOLUTE DAMAGE");
      console.log("➡️ ignora crítico, defesa e reduções");
      console.log(`📈 Final: ${event.damage}`);
      console.groupEnd();
    }

    return;
  }

  // aplica crítico
  if (event.crit.didCrit) {
    event.damage += event.crit.critExtra;
  }

  const baseDefense = event.target.baseDefense ?? event.target.Defense;
  const currentDefense = event.target.Defense;

  const defenseUsed = event.crit.didCrit
    ? Math.min(baseDefense, currentDefense)
    : currentDefense;

  const defensePercent = defenseToPercent(
    defenseUsed,
    event.constructor.debugMode,
  );

  const { flat, percent } = event.target.getTotalDamageReduction?.() || {
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
    event.damage = Math.max(event.damage - defenseMitigation, 0);

    if (debug) {
      console.log(
        `[DAMAGE COMPOSITION] 🛡️ Após defesa (${(defensePercent * 100).toFixed(
          1,
        )}%): ${event.damage}`,
      );
    }

    // Redução percentual
    event.damage *= 1 - percent / 100;

    if (debug) {
      console.log(
        `[DAMAGE COMPOSITION] 📉 Após redução percentual (${percent}%): ${event.damage}`,
      );
    }

    // Redução flat
    event.damage = Math.max(event.damage - flat, 0);

    if (debug) {
      console.log(
        `[DAMAGE COMPOSITION] 🧱 Após redução flat (${flat}): ${event.damage}`,
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

    standardAfter = Math.max(standardAfter, 0);
    piercingAfter = Math.max(piercingAfter, 0);

    event.damage = standardAfter + piercingAfter;
  }

  // -------- FLOOR --------
  if (!event.context?.ignoreMinimumFloor) {
    event.damage = Math.max(event.damage, 10);
  }

  event.damage = Math.min(
    _roundToFive(event.damage),
    event.constructor.GLOBAL_DMG_CAP,
  );

  // 2. Tira a foto do dano matemático final, pronto para ser aplicado

  const damageOverride = event.context?.editMode?.damageOutput;
  console.log(
    `📸 [DAMAGE COMPOSITION] Dano final calculado (antes de overrides): ${event.damage}`,
  );

  if (damageOverride != null) {
    event.damage = damageOverride;
    console.log(
      `⚡ [DAMAGE COMPOSITION] Override de dano ativado! Dano forçado para: ${event.damage}`,
    );
    if (event.constructor.debugMode) console.groupEnd();
  }

  event.finalDamage = event.damage;

  if (event.constructor.debugMode) {
    console.log(`[DAMAGE COMPOSITION] 📈 Final: ${event.finalDamage}`);
    console.groupEnd();
  }
}

function _roundToFive(x) {
  return Math.round(x / 5) * 5;
}
