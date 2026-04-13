import { emitCombatEvent } from "../combatEvents.js";
import { composeDamage } from "./03_composeDamage.js";

export function runBeforeHooks(event) {
  if (event.mode === event.constructor.Modes.ABSOLUTE) return;

  const preHookCrit = _snapshotCrit(event.crit);
  const basePreMitigationDamage = event.preMitigationDamage ?? event.damage;
  const preHookBaseDamage = Number(event.baseDamage ?? 0);

  const deal = _applyBeforeDealingPassive(event);
  const take = _applyBeforeTakingPassive(event);

  const critWasChanged =
    deal.critChanged ||
    take.critChanged ||
    !_isSameCrit(preHookCrit, _snapshotCrit(event.crit));

  const damageModelWasChanged =
    deal.damageModelChanged || take.damageModelChanged;

  if (critWasChanged || damageModelWasChanged) {
    // Recompõe usando dano pré-mitigação para que mudança de crítico
    // impacte defesa, mitigação e dano final da mesma forma do step 3.
    const preMitigationFromHooks =
      take.preMitigationDamage ?? deal.preMitigationDamage;

    if (typeof preMitigationFromHooks === "number") {
      event.damage = preMitigationFromHooks;
    } else if (
      damageModelWasChanged &&
      preHookBaseDamage > 0 &&
      Number(event.baseDamage ?? 0) > 0
    ) {
      // Mantém proporção de quaisquer ajustes feitos no step 2
      // quando o hook altera o baseDamage no step 4.
      const ratio = Number(event.baseDamage) / preHookBaseDamage;
      event.damage = basePreMitigationDamage * ratio;
    } else {
      event.damage = basePreMitigationDamage;
    }

    composeDamage(event);
  }

  // Consolida logs e efeitos no estado da classe/contexto
  if (deal.logs.length) event.beforeLogs.push(...deal.logs);
  if (take.logs.length) event.beforeLogs.push(...take.logs);

  if (event.crit?.didCrit) {
    emitCombatEvent(
      "onCriticalHit",
      {
        attacker: event.attacker,
        defender: event.defender,
        context: event.context,
        forced: event.crit?.forced,
      },
      event.allChampions ?? event.context?.allChampions,
    );
  }
}

function _applyBeforeDealingPassive(event) {
  return _processHook(event, "onBeforeDmgDealing", {
    mode: event.mode,
    damage: event.damage,
    baseDamage: event.baseDamage,
    preMitigationDamage: event.preMitigationDamage,
    piercingPortion: event.piercingPortion,
    crit: event.crit,
    skill: event.skill,
    attacker: event.attacker,
    defender: event.defender,
    context: event.context,
  });
}

function _applyBeforeTakingPassive(event) {
  return _processHook(event, "onBeforeDmgTaking", {
    mode: event.mode,
    damage: event.damage,
    baseDamage: event.baseDamage,
    preMitigationDamage: event.preMitigationDamage,
    piercingPortion: event.piercingPortion,
    crit: event.crit,
    skill: event.skill,
    attacker: event.attacker,
    defender: event.defender,
    context: event.context,
  });
}

function _processHook(event, eventName, payload) {
  // JSON.stringify força o JS a ler o valor exato AGORA, sem preguiça de log
  /*   console.log("[ALL CHAMPIONS DEBUG]", event.allChampions); */

  // Verifique se o event.allChampions não foi redefinido por acidente
  if (!event.allChampions || event.allChampions.length === 0) {
    /*  console.error("❌ ERRO CRÍTICO: allChampions sumiu antes do emit!"); */
  }
  const results = emitCombatEvent(eventName, payload, event.allChampions) || [];
  const summary = {
    logs: [],
    critChanged: false,
    damageModelChanged: false,
    preMitigationDamage: undefined,
  };

  for (const r of results) {
    if (!r) continue;

    // Caso legado: Array direto de logs
    if (Array.isArray(r)) {
      summary.logs.push(...r);
      continue;
    }

    // Mutação de estado do evento
    if (r.damage !== undefined) {
      event.damage = r.damage;
      event.finalDamage = event.damage;
    }
    if (r.baseDamage !== undefined) {
      event.baseDamage = Number(r.baseDamage);
      summary.damageModelChanged = true;
    }
    if (r.mode !== undefined) {
      event.mode = r.mode;
      summary.damageModelChanged = true;
    }
    if (r.piercingPortion !== undefined) {
      event.piercingPortion = Number(r.piercingPortion);
      summary.damageModelChanged = true;
    }
    if (r.preMitigationDamage !== undefined) {
      summary.preMitigationDamage = Number(r.preMitigationDamage);
      summary.damageModelChanged = true;
    }
    if (r.crit !== undefined) {
      summary.critChanged = true;
      event.crit = r.crit;
    }

    // Consolidação de Logs e Effects (Uso de set de chaves para enxugar)
    ["log", "logs"].forEach((key) => {
      if (r[key]) {
        const val = Array.isArray(r[key]) ? r[key] : [r[key]];
        summary.logs.push(...val);
      }
    });
  }
  return summary;
}

function _snapshotCrit(crit) {
  if (!crit) return null;
  return {
    didCrit: !!crit.didCrit,
    bonus: Number(crit.bonus ?? 0),
    critExtra: Number(crit.critExtra ?? 0),
    forced: !!crit.forced,
    disabled: !!crit.disabled,
  };
}

function _isSameCrit(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.didCrit === b.didCrit &&
    a.bonus === b.bonus &&
    a.critExtra === b.critExtra &&
    a.forced === b.forced &&
    a.disabled === b.disabled
  );
}
