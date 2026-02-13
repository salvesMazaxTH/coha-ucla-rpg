/**
 * Formata o nome de um campeão com HTML incluindo a classe do time
 * para aplicar cores diferentes no log de combate
 *
 * @param {Champion} champion - O objeto campeão
 * @returns {string} - Nome formatado com HTML
 */
export function formatChampionName(champion) {
  if (!champion || !champion.name) {
    return "Desconhecido";
  }

  const teamClass = champion.team === 1 ? "team-1" : "team-2";
  return `<span class="${teamClass}">${champion.name}</span>`;
}

/**
 * Formata o nome de um jogador com HTML incluindo a classe do time
 *
 * @param {string} playerName - Nome do jogador
 * @param {number} team - Número do time (1 ou 2)
 * @returns {string} - Nome formatado com HTML
 */
export function formatPlayerName(playerName, team) {
  if (!playerName) {
    return "Desconhecido";
  }

  const teamClass = team === 1 ? "team-1" : "team-2";
  return `<span class="${teamClass}">${playerName}</span>`;
}
