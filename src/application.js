const express = require('express');
const joi = require('@hapi/joi');
const Redis = require('ioredis');
const Player = require('./player');
const Game = require('./game');

const REDIS_URL = process.env.REDIS_RUL || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next()
})

redis
  .on('error', (error) => {
    console.error(error);
  })
  .on('connect', () => {
    console.log(`Server is connected to redis at ${REDIS_URL}`);
  });

// schemas


const playerNameSchema = joi.string();
const playerWonSchema = joi.boolean();
const gameCreationSchema = joi.array()
  .items({ name: playerNameSchema, won: playerWonSchema })
  .has({ name: playerNameSchema, won: playerWonSchema.valid(true) })
  .min(2)
  .required();

// routes

app.post('/games', async (req, res) => {
  let gameCreationCommand;
  try {
    gameCreationCommand = joi.attempt(req.body, gameCreationSchema);
  } catch (e) {
    res.status(400).send(e.message);
    return;
  }

  const rawEloPerPlayer = await redis.get('eloPerPlayer');
  const eloPerPlayer = JSON.parse(rawEloPerPlayer) || {};

  const rawGames = await redis.get('games');
  const games = JSON.parse(rawGames) || [];

  const game = createGame(gameCreationCommand, eloPerPlayer, games);
  games.push(game);
  redis.set('games', JSON.stringify(games));

  game.players.forEach((player) => {
    eloPerPlayer[player.name] = player.elo;
  });
  redis.set('eloPerPlayer', JSON.stringify(eloPerPlayer));

  res.status(204).send();
});

app.get('/ladder', async (req, res) => {
  const rawEloPerPlayer = await redis.get('eloPerPlayer');

  const eloPerPlayer = JSON.parse(rawEloPerPlayer) || {};
  const ladder = Object.keys(eloPerPlayer)
    .map(toPlayer(eloPerPlayer))
    .sort(highestEloFirst);

  res.status(200).send(ladder);
});

// usecases

function createGame(command, eloPerPlayer) {
  const itemThatWon = command.find(hasWon);
  const players = command.map((item) => toPlayer(eloPerPlayer)(item.name));
  const game = new Game(players);

  const playerWhoWon = players.find(nameMatches(itemThatWon));
  game.finish(playerWhoWon);

  return game;
}

// utils

const toPlayer = (eloPerPlayer) => (playerName) => new Player(playerName, eloPerPlayer[playerName]);
const highestEloFirst = (a, b) => b.elo - a.elo;
const hasWon = (player) => player.won === true;
const nameMatches = (itemThatWon) => (player) => player.name === itemThatWon.name;

module.exports = app;
