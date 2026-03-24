import { emitCombatEvent } from "../combatEvents.js";

export function runAfterHooks(event) {
  // 1. Executa hooks de passivas
  const afterTake = _applyAfterTakingPassive(event);
  const afterDeal = _applyAfterDealingPassive(event);

  // 2. Sincroniza logs e efeitos das passivas
  if (afterTake.logs.length) event.afterLogs.push(...afterTake.logs);
  if (afterDeal.logs.length) event.afterLogs.push(...afterDeal.logs);

  // 3. Processa Lifesteal
  const lsResult = _applyLifeSteal(event);

  if (lsResult) {
    // Salva na instância para o buildFinalResult usar
    event.lifesteal = lsResult;

    // Adiciona o log do lifesteal e de possíveis passivas ativadas por ele
    event.afterLogs.push(lsResult.log);
    if (lsResult.passiveLogs.length) {
      event.afterLogs.push(...lsResult.passiveLogs);
    }
  }
}

function _applyLifeSteal(event) {
  if (event.constructor.debugMode) console.group(`💉 [LIFESTEAL]`);

  // 1. Validações iniciais usando os dados da instância
  const lsRate = event.attacker?.LifeSteal || 0;
  if (lsRate <= 0 || event.actualDmg <= 0 || event.context.isDot) {
    if (event.constructor.debugMode) {
      console.log(
        `⚠️ Pulando Lifesteal: LS=${lsRate}%, DMG=${event.actualDmg}`,
      );
      console.groupEnd();
    }
    return null;
  }

  // 2. Cálculo do heal
  const rawHeal = (event.actualDmg * lsRate) / 100;

  // 3. Aplica a cura (heal() garante floor e mínimo de 1)
  const effectiveHeal = event.attacker.heal(rawHeal, event.context);

  if (effectiveHeal <= 0) {
    if (event.constructor.debugMode) console.groupEnd();
    return null;
  }

  // 4. Dispara evento para passivas reativas a lifesteal (ex: "ao curar, ganhe buff")
  const results =
    emitCombatEvent(
      "onAfterLifeSteal",
      {
        source: event.attacker,
        amount: effectiveHeal,
        context: event.context,
      },
      event.allChampions,
    ) || [];

  // 5. Coleta logs de passivas que reagiram ao lifesteal
  const passiveLogs = [];
  for (const r of results) {
    if (r?.log) {
      if (Array.isArray(r.log)) passiveLogs.push(...r.log);
      else passiveLogs.push(r.log);
    }
  }

  if (event.constructor.debugMode) {
    console.log(
      `📊 Efetivo: ${effectiveHeal} (HP: ${event.attacker.HP}/${event.attacker.maxHP})`,
    );
    console.groupEnd();
  }

  return {
    amount: effectiveHeal,
    log: `Roubo de vida: ${effectiveHeal} | HP: ${event.attacker.HP}/${event.attacker.maxHP}`,
    passiveLogs,
  };
}

function _applyAfterTakingPassive(event) {
  return _processHook(event, "onAfterDmgTaking", {
    attacker: event.attacker,
    defender: event.defender,
    skill: event.skill,
    damage: event.damage,
    mode: event.mode,
    crit: event.crit,
    context: event.context,
  });
}

function _applyAfterDealingPassive(event) {
  if (event.context?.isDot) return { logs: [] };
  return _processHook(event, "onAfterDmgDealing", {
    attacker: event.attacker,
    defender: event.defender,
    damage: event.damage,
    mode: event.mode,
    crit: event.crit,
    skill: event.skill,
    context: event.context,
  });
}

function _processHook(event, eventName, payload) {
  // JSON.stringify força o JS a ler o valor exato AGORA, sem preguiça de log
  /*   console.log("[ALL CHAMPIONS DEBUG]", event.allChampions);
   */
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
    if (r.damage !== undefined) event.damage = r.damage;
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
