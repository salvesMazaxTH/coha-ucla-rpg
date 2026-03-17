class LobbyState {
  constructor(match) {
    this.match = match;
    this.socketToSlot = new Map();
    this.selectionTimers = [null, null];
    this.disconnectionTimers = new Map();
  }

  assignSocketToSlot(socketId, slot) {
    this.socketToSlot.set(socketId, slot);

    const player = this.match.getPlayer(slot);
    if (player) {
      player.setSocket(socketId);
    }
  }

  getSlotBySocket(socketId) {
    return this.socketToSlot.get(socketId);
  }

  removeSocket(socketId) {
    this.socketToSlot.delete(socketId);
  }

  setSelectionTimer(slot, timerId) {
    this.clearSelectionTimer(slot);
    this.selectionTimers[slot] = timerId;
  }

  clearSelectionTimer(slot) {
    const timer = this.selectionTimers[slot];
    if (!timer) return;
    clearTimeout(timer);
    this.selectionTimers[slot] = null;
  }

  clearAllSelectionTimers() {
    for (let slot = 0; slot < this.selectionTimers.length; slot++) {
      this.clearSelectionTimer(slot);
    }
  }

  setDisconnectionTimer(slot, timerId) {
    this.clearDisconnectionTimer(slot);
    this.disconnectionTimers.set(slot, timerId);
  }

  getDisconnectionTimer(slot) {
    return this.disconnectionTimers.get(slot);
  }

  clearDisconnectionTimer(slot) {
    const timer = this.disconnectionTimers.get(slot);
    if (!timer) return;
    clearTimeout(timer);
    this.disconnectionTimers.delete(slot);
  }

  clearAllDisconnectionTimers() {
    for (const [slot] of this.disconnectionTimers) {
      this.clearDisconnectionTimer(slot);
    }
  }

  reset() {
    this.socketToSlot.clear();
    this.clearAllSelectionTimers();
    this.clearAllDisconnectionTimers();
  }
}

class CombatState {
  constructor(match) {
    this.match = match;
    this.reset();
  }

  reset() {
    this.currentTurn = 1;
    this.pendingActions = [];
    this.activeChampions = new Map();
    this.deadChampions = new Map();
    this.playerScores = [0, 0];
    this.gameEnded = false;
    this.started = false;
    this.playersReadyToEndTurn = new Set();
    this.finishedAnimationSockets = new Set();
    this.combatSnapshot = [];
    this.turnHistory = new Map();
  }

  resetProgress() {
    this.pendingActions = [];
    this.currentTurn = 1;
    this.playersReadyToEndTurn.clear();
    this.finishedAnimationSockets.clear();
    this.turnHistory.clear();
    this.playerScores = [0, 0];
    this.gameEnded = false;
  }

  start() {
    this.started = true;
  }

  stop() {
    this.started = false;
  }

  ensureTurnEntry() {
    if (!this.turnHistory.has(this.currentTurn)) {
      this.turnHistory.set(this.currentTurn, {
        events: [],
        championsDeadThisTurn: [],
        skillsUsedThisTurn: {},
        damageDealtThisTurn: {},
      });
    }

    return this.turnHistory.get(this.currentTurn);
  }

  logTurnEvent(eventType, eventData) {
    const turnData = this.ensureTurnEntry();
    turnData.events.push({
      type: eventType,
      ...eventData,
      timestamp: Date.now(),
    });
  }

  getChampion(championId) {
    return (
      this.activeChampions.get(championId) ||
      this.deadChampions.get(championId) ||
      null
    );
  }

  getAliveChampions() {
    return [...this.activeChampions.values()].filter(
      (champion) => champion.alive,
    );
  }

  getPlayerChampions(team) {
    return [
      ...this.activeChampions.values(),
      ...this.deadChampions.values(),
    ].filter((champion) => champion.team === team);
  }

  getAliveChampionsForTeam(team) {
    return this.getAliveChampions().filter(
      (champion) => champion.team === team,
    );
  }

  getChampionAtSlot(team, slot) {
    return (
      [...this.activeChampions.values()].find(
        (c) => c.team === team && c.combatSlot === slot,
      ) || null
    );
  }

  getTeamLine(team) {
    return [...this.activeChampions.values()]
      .filter((c) => c.team === team && Number.isInteger(c.combatSlot))
      .sort((a, b) => a.combatSlot - b.combatSlot);
  }

  getAdjacentChampions(target, { side = "both" } = {}) {
    const champion =
      typeof target === "string" ? this.getChampion(target) : target;

    if (!champion || !Number.isInteger(champion.combatSlot)) return [];

    const left = this.getChampionAtSlot(champion.team, champion.combatSlot - 1);
    const right = this.getChampionAtSlot(
      champion.team,
      champion.combatSlot + 1,
    );

    if (side === "left") return left ? [left] : [];
    if (side === "right") return right ? [right] : [];

    return [left, right].filter(Boolean);
  }

  registerChampion(champion, { trackSnapshot = true } = {}) {
    this.deadChampions.delete(champion.id);
    this.activeChampions.set(champion.id, champion);

    if (trackSnapshot) {
      this.combatSnapshot.push({
        championKey: champion.key,
        id: champion.id,
        team: champion.team,
        combatSlot: champion.combatSlot,
      });
    }
  }

  removeChampion(championId) {
    const champion = this.activeChampions.get(championId);
    if (!champion) return null;

    this.activeChampions.delete(championId);
    this.deadChampions.set(championId, champion);
    return champion;
  }

  /**
   * Remove um campeão morto do jogo: registra no histórico, atualiza placar, move para deadChampions.
   * Retorna um objeto com os dados necessários para o server emitir sockets, ou null se não encontrado.
   */
  removeChampionFromGame(championId, maxScore = 3) {
    const champion = this.activeChampions.get(championId);
    if (!champion) return null;

    // Registrar morte no histórico
    this.logTurnEvent("championDied", {
      championId,
      championName: champion.name,
      team: champion.team,
    });
    this.ensureTurnEntry().championsDeadThisTurn.push(championId);

    // Scoring
    const scoringTeam = champion.team === 1 ? 2 : 1;
    const scoringPlayerSlot = scoringTeam - 1;
    let scored = false;

    if (!this.gameEnded) {
      this.addPointForSlot(scoringPlayerSlot, maxScore);
      scored = true;
    }

    // Mover para deadChampions
    this.removeChampion(championId);

    return {
      championId,
      championName: champion.name,
      team: champion.team,
      scoringTeam,
      scoringPlayerSlot,
      scored,
      gameEnded: this.gameEnded,
    };
  }

  clearActions() {
    this.pendingActions.length = 0;
  }

  enqueueAction(action) {
    if (!action) return;
    this.pendingActions.push(action);
  }

  nextTurn() {
    this.currentTurn += 1;
  }

  clearTurnReadiness() {
    this.playersReadyToEndTurn.clear();
  }

  addPointForSlot(slot, maxScore = 3) {
    this.playerScores[slot] += 1;
    if (this.playerScores[slot] >= maxScore) {
      this.gameEnded = true;
    }
  }

  setWinnerScore(slot, maxScore = 3) {
    this.playerScores[slot] = maxScore;
    this.gameEnded = true;
  }

  getScorePayload() {
    return {
      player1: this.playerScores[0],
      player2: this.playerScores[1],
    };
  }
}

export class GameMatch {
  constructor() {
    this.players = [null, null];
    this.lobby = new LobbyState(this);
    this.combat = new CombatState(this);
  }

  getPlayer(slot) {
    return this.players[slot] || null;
  }

  setPlayer(slot, player) {
    this.players[slot] = player || null;
  }

  getOpponent(slot) {
    return slot === 0 ? this.players[1] : this.players[0];
  }

  areBothPlayersConnected() {
    return !!(this.players[0] && this.players[1]);
  }

  getConnectedCount() {
    return this.players.filter((player) => player !== null).length;
  }

  getPlayerNamesEntries() {
    const entries = [];

    for (let slot = 0; slot < this.players.length; slot++) {
      const player = this.players[slot];
      if (!player) continue;
      entries.push([slot, player.username]);
    }

    return entries;
  }

  isTeamSelected(slot) {
    return !!this.players[slot]?.isTeamSelected();
  }

  // Lobby delegation
  assignSocketToSlot(socketId, slot) {
    this.lobby.assignSocketToSlot(socketId, slot);
  }

  getSlotBySocket(socketId) {
    return this.lobby.getSlotBySocket(socketId);
  }

  removeSocket(socketId) {
    this.lobby.removeSocket(socketId);
  }

  setSelectionTimer(slot, timerId) {
    this.lobby.setSelectionTimer(slot, timerId);
  }

  clearSelectionTimer(slot) {
    this.lobby.clearSelectionTimer(slot);
  }

  setDisconnectionTimer(slot, timerId) {
    this.lobby.setDisconnectionTimer(slot, timerId);
  }

  getDisconnectionTimer(slot) {
    return this.lobby.getDisconnectionTimer(slot);
  }

  clearDisconnectionTimer(slot) {
    this.lobby.clearDisconnectionTimer(slot);
  }

  // Combat delegation
  ensureTurnEntry() {
    return this.combat.ensureTurnEntry();
  }

  logTurnEvent(eventType, eventData) {
    this.combat.logTurnEvent(eventType, eventData);
  }

  registerChampion(champion, options = {}) {
    this.combat.registerChampion(champion, options);
  }

  removeChampion(championId) {
    return this.combat.removeChampion(championId);
  }

  removeChampionFromGame(championId, maxScore = 3) {
    return this.combat.removeChampionFromGame(championId, maxScore);
  }

  getChampion(championId) {
    return this.combat.getChampion(championId);
  }

  getAliveChampions() {
    return this.combat.getAliveChampions();
  }

  getCurrentTurn() {
    return this.combat.currentTurn;
  }

  nextTurn() {
    this.combat.nextTurn();
  }

  resetCombat() {
    this.combat.reset();
  }

  startCombat() {
    this.combat.start();
  }

  isCombatStarted() {
    return this.combat.started;
  }

  isGameEnded() {
    return this.combat.gameEnded;
  }

  addPointForSlot(slot, maxScore = 3) {
    this.combat.addPointForSlot(slot, maxScore);
  }

  setWinnerScore(slot, maxScore = 3) {
    this.combat.setWinnerScore(slot, maxScore);
  }

  getScorePayload() {
    return this.combat.getScorePayload();
  }

  clearActions() {
    this.combat.clearActions();
  }

  enqueueAction(action) {
    this.combat.enqueueAction(action);
  }

  clearTurnReadiness() {
    this.combat.clearTurnReadiness();
  }

  addReadyPlayer(slot) {
    this.combat.playersReadyToEndTurn.add(slot);
  }

  removeReadyPlayer(slot) {
    this.combat.playersReadyToEndTurn.delete(slot);
  }

  isPlayerReady(slot) {
    return this.combat.playersReadyToEndTurn.has(slot);
  }

  getReadyPlayersCount() {
    return this.combat.playersReadyToEndTurn.size;
  }

  addFinishedAnimationSocket(socketId) {
    this.combat.finishedAnimationSockets.add(socketId);
  }

  clearFinishedAnimationSockets() {
    this.combat.finishedAnimationSockets.clear();
  }

  getFinishedAnimationCount() {
    return this.combat.finishedAnimationSockets.size;
  }

  clearPlayers() {
    this.players = [null, null];
    this.lobby.reset();
    this.combat.reset();
  }
}
