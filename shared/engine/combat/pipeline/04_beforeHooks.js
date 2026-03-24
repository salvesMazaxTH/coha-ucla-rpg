import { emitCombatEvent } from "../combatEvents.js";

export function runBeforeHooks(event) {
  if (event.mode === event.constructor.Modes.ABSOLUTE) return;

  const deal = _applyBeforeDealingPassive(event);
  const take = _applyBeforeTakingPassive(event);

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
  const summary = { logs: [] };

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
    if (r.crit !== undefined) event.crit = r.crit;

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
