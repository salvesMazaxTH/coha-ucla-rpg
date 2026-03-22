export class Player {
  constructor({ id, username, team }) {
    this.id = id;
    this.username = username;
    this.team = team;
    this.socketId = null;
    this.selectedChampionKeys = [];
    this.remainingSwitches = 2;
  }

  setSocket(socketId) {
    this.socketId = socketId;
  }

  clearSocket() {
    this.socketId = null;
  }

  setSelectedChampionKeys(championKeys = []) {
    this.selectedChampionKeys = Array.isArray(championKeys) ? championKeys : [];
  }

  clearChampionSelection() {
    this.selectedChampionKeys = [];
  }

  isTeamSelected() {
    return this.selectedChampionKeys.length > 0;
  }
}
