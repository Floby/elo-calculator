module.exports = class Game {
  constructor(players, sessionId) {
    this.checkPlayersNameAreUnique(players);
    this.players = players;
    this.sessionId = sessionId;
  }

  finish(winner) {
    this.players.forEach((player) => {
      const opponents = this.getOpponents(player);
      if (this.hasWon(winner, player)) {
        player.wins(opponents);
      } else {
        player.looses(opponents);
      }
    });
  }

  hasWon(winner, player) {
    return winner.name === player.name;
  }

  getOpponents(player) {
    return this.players.filter((p) => p.name !== player.name);
  }

  checkPlayersNameAreUnique(players) {
    const playerNames = players.map((p) => p.name);
    const playersContainDuplicateNames = (new Set(playerNames)).size !== players.length;
    if (playersContainDuplicateNames) {
      throw new Error(`Names must be unique. Names provided: ${playerNames}`);
    }
  }
};
