export function processExtraQueue(event) {
  const queue = event.context.extraDamageQueue || [];
  if (queue.length === 0) return [];

  console.log(
    `🔥 processExtraQueue: Processando ${queue.length} eventos extras.`,
  );

  // Limpa a fila original para evitar loops infinitos caso os novos eventos gerem mais eventos
  const itemsToProcess = [...queue];
  event.context.extraDamageQueue = [];

  const results = [];

  for (const extra of itemsToProcess) {
    // 1. Criamos uma nova instância para o evento extra (Reflect, Thorns, etc)
    const extraEvent = new event.constructor({
      ...extra, // baseDamage, attacker, defender, skill, etc.
      allChampions: event.allChampions,
      context: {
        ...event.context,
        // Incrementa a profundidade para evitar recursão infinita (trava em 2 ou 3)
        damageDepth: (event.context.damageDepth || 0) + 1,
        origin: extra.skill?.key || "reaction",
        // Importante: Passamos a referência da fila limpa para o novo evento
        extraDamageQueue: event.context.extraDamageQueue,
      },
    });

    // 2. Executamos a pipeline completa do novo evento
    const result = extraEvent.execute();

    // 3. Acumulamos o resultado formatado
    if (Array.isArray(result)) results.push(...result);
    else if (result) results.push(result);
  }

  // Armazena no estado interno da instância atual para o buildFinalResult consolidar depois
  event.extraResults.push(...results);
  return results;
}
