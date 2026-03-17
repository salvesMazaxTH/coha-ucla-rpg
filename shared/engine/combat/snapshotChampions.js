/** snapshotChampions.js
 * shared/engine/combat/snapshotChampions.js
 * Gera snapshots serializados dos campeões a partir de uma lista de IDs.
 * Usado para enviar o estado final pós-ação ao cliente.
 */
export function snapshotChampions(source) {
  if (!source) return null;

  const snapshots = [];

  if (source instanceof Map) {
    for (const champion of source.values()) {
      if (champion?.serialize) snapshots.push(champion.serialize());
    }
  } else {
    console.error("snapshotChampions: fonte de dados inesperada. Esperado Map, recebido:", source);
  }

  return snapshots.length ? snapshots : null;
}
