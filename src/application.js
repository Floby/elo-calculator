const express = require('express')
const joi = require('@hapi/joi')
const Player = require('./player')
const Game = require('./game')
const redis = require('redis')

const client = redis.createClient()
const app = express()

app.use(express.json())
client.on('error', function (error) {
  console.error(error)
})

// schemas

const playerNameSchema = joi.string()
const playerWonSchema = joi.boolean()
const gameCreationSchema = joi.array()
  .items({ name: playerNameSchema, won: playerWonSchema })
  .has({ name: playerNameSchema, won: playerWonSchema.valid(true) })

// routes

app.post('/games', (req, res) => {
  let gameCreationCommand
  try {
    gameCreationCommand = joi.attempt(req.body, gameCreationSchema)
  } catch (e) {
    res.status(400).send(e.message)
    return
  }

  client.get('eloPerPlayer', (rawEloPerPlayer) => {
    const eloPerPlayer = JSON.parse(rawEloPerPlayer) || {}
    console.log(eloPerPlayer)
    client.get('games', (rawGames) => {
      const games = JSON.parse(rawGames) || []
      const game = createGame(gameCreationCommand, eloPerPlayer, games)
      games.push(game)
      client.set('games', JSON.stringify(games))

      game.players.forEach(player => eloPerPlayer[player.name] = player.elo)
      client.set('eloPerPlayer', JSON.stringify(eloPerPlayer))
    })
  })

  res.status(204).send()
})

app.get('/ladder', (req, res) => {
  client.get('eloPerPlayer', (rawEloPerPlayer) => {
    const eloPerPlayer = JSON.parse(rawEloPerPlayer) || {}
    const ladder = Object.keys(eloPerPlayer)
      .map(toPlayer(eloPerPlayer))
      .sort(highestEloFirst)
    res.status(200).send(ladder)
  })
})

// usecases

function createGame(command, eloPerPlayer, games) {
  const itemThatWon = command.find(hasWon)
  const players = command.map(item => toPlayer(eloPerPlayer)(item.name))
  const game = new Game(players)

  const playerWhoWon = players.find(nameMatches(itemThatWon))
  game.finish(playerWhoWon)

  return game
}

// utils

const toPlayer = (eloPerPlayer) => (playerName) => new Player(playerName, eloPerPlayer[playerName])
const highestEloFirst = (a, b) => b.elo - a.elo
const hasWon = (player) => player.won === true
const nameMatches = (itemThatWon) => (player) => player.name === itemThatWon.name

module.exports = app
