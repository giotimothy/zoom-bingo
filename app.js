"use strict";

/*
 * This .js (node.js) file is the back-end code for my zoomingo site. It is
 * responsible to respond to any API requests sent by the front-end. This file
 * interacts with the database and supply my zoom bingo game with the data it needs.
 */
const express = require('express');
const multer = require('multer');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const app = express();
const DB_NAME = 'zoomingo.db';
const SERVER_ERROR_CODE = 500;
const CLIENT_ERROR_CODE = 400;
const SERVER_ERROR_MSG = "Server error! Please try again later.";

// to handle POST with application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// to handle POST with application/json
app.use(express.json());

// to handle POST with multipart/form-data
app.use(multer().none());

/**
 * /newGame endpoint, GET
 * An endpoint for /newGame, creates a new game.
 * Generate a new board (scenario id and its text).
 * Generate a new game ID.
 * Update and Insert to most tables in the database.
 * Returns a JSON to the front-end containing all the information needed for a new game.
 */
app.get('/newGame', async (req, res) => {
  const db = await getDBConnection();
  let playerName = req.query.name;
  let idOfPlayer;
  let sizeOfBoard = req.query.size;
  let middlePos = (sizeOfBoard - 1) / 2;
  let selectAllScenario = "SELECT id, text FROM scenarios WHERE id > 1 ORDER BY random() LIMIT ?;";
  let game = "INSERT INTO game_state (game_id, player_id, given_scenario_ids) VALUES (?, ?, ?);";
  try {
    let generatedBoardArr = await db.all(selectAllScenario, [sizeOfBoard]);
    let freeJson = await db.all("SELECT id, text FROM scenarios WHERE id = 1;");
    generatedBoardArr[middlePos] = freeJson[0];
    let insertToGames = await db.run("INSERT INTO games (winner) VALUES (?);", [null]);
    let newGameId = insertToGames.lastID;
    let findName = await db.all("SELECT id, name FROM players WHERE name=?;", [playerName]);
    if (findName.length != 0) {
      idOfPlayer = findName[0].id;
    } else {
      let insertNewPlayer = await db.run("INSERT INTO players (name) VALUES (?);", [playerName]);
      idOfPlayer = insertNewPlayer.lastID;
    }
    let givenIdArray = [];
    for (let i = 0; i < generatedBoardArr.length; i++) {
      givenIdArray.push(generatedBoardArr[i].id);
    }
    let stringBoard = JSON.stringify(givenIdArray);
    await db.run(game, [newGameId, idOfPlayer, stringBoard]);
    res.json({
      "game_id": newGameId,
      "player": {
        "id": idOfPlayer,
        "name": playerName,
        "board": generatedBoardArr
      }
    });
    await db.close();
  } catch {
    res.status(SERVER_ERROR_CODE).json(SERVER_ERROR_MSG);
  }
});

/**
 * /selectScenarios endpoint, POST
 * An endpoint for /selectScenarios, update the database for this new selected scenario.
 * Validates whether or not this scenario was given initially in the corresponding game state.
 * Validates whether or not that the scenario has already been selected.
 * Updates the database for this scenario is selected.
 * Returns a JSON containing the game and the scenario ID to the front-end.
 */
app.post('/selectScenarios', async (req, res) => {
  const db = await getDBConnection();
  let gameId = req.body.game_id;
  let scenarioId = req.body.scenario_id;
  let getGameState = "SELECT * FROM game_state WHERE game_id=?;";
  try {
    let thisGameState = await db.all(getGameState, [gameId]);
    let givenScenString = thisGameState[0].given_scenario_ids;
    let selectedScenString = thisGameState[0].selected_scenario_ids;
    let givenIdsArr = JSON.parse(givenScenString);
    let selectedIdsArr = JSON.parse(selectedScenString);
    let scenarioIdNumber = parseInt(scenarioId);
    if (givenIdsArr.includes(scenarioIdNumber) && !selectedIdsArr.includes(scenarioIdNumber)) {
      selectedIdsArr.push(scenarioIdNumber);
      let updatedSelectedIdsString = JSON.stringify(selectedIdsArr);
      let update = "UPDATE game_state SET selected_scenario_ids = ? WHERE game_id=?;";
      await db.run(update, [updatedSelectedIdsString, gameId]);
      res.json({
        "game_id": gameId,
        "scenario_id": scenarioIdNumber
      });
    } else {
      let errorString = "Could not select scenario ID: " + scenarioId;
      res.status(CLIENT_ERROR_CODE).json({
        "error": errorString
      });
    }
    await db.close();
  } catch {
    res.status(SERVER_ERROR_CODE).json(SERVER_ERROR_MSG);
  }
});

/**
 * /bingo endpoint, POST
 * An endpoint for /endpoint, checks whether or not the game has been won.
 * Validates whether or not the game has a winner
 * Return the result as a JSON to the front-end.
 * The JSON can contain an error or a result.
 * The result JSON consists of the game ID and the winner's name (player's name).
 */
app.post('/bingo', async (req, res) => {
  const db = await getDBConnection();
  let idOfThisGame = req.body.game_id;
  let getGameState = "SELECT * FROM game_state WHERE game_id=?;";
  try {
    let gameStateArr = await db.all(getGameState, [idOfThisGame]);
    let gameStateJson = gameStateArr[0];
    let givenArr = JSON.parse(gameStateJson.given_scenario_ids);
    let atLeast = Math.sqrt(givenArr.length);
    let selectedArr = JSON.parse(gameStateJson.selected_scenario_ids);
    let gameWinner = await db.all("SELECT * FROM games WHERE game_id=?;", [idOfThisGame]);
    let winner = gameWinner[0].winner;
    if (winner != null) {
      let gameWonAlready = "Game has already been won.";
      res.status(CLIENT_ERROR_CODE).json({
        "error": gameWonAlready
      });
    } else {
      if (selectedArr.length >= atLeast) {
        let thisPlayer = gameStateJson.player_id;
        let updateWinner = "UPDATE games SET winner = ? WHERE game_id=?;";
        await db.run(updateWinner, [thisPlayer, idOfThisGame]);
        let player = await db.all("SELECT * FROM players WHERE id=?;", [thisPlayer]);
        let nameOfPlayer = player[0].name;
        res.json({
          "game_id": idOfThisGame,
          "winner": nameOfPlayer
        });
      } else {
        res.json({
          "game_id": idOfThisGame,
          "winner": null
        });
      }
    }
    await db.close();
  } catch {
    res.status(SERVER_ERROR_CODE).json(SERVER_ERROR_MSG);
  }
});

/**
 * /resumeGame endpoint, GET
 * An endpoint for /resumeGame, retrieve the game state for this game.
 * Returned a JSON containing all of the information for this game state.
 * If the user is not part of this game, an error is returned instead.
 */
app.get('/resumeGame', async (req, res) => {
  const db = await getDBConnection();
  let idGame = req.query.game_id;
  let idPlayer = req.query.player_id;
  let takeGameState = "SELECT * FROM game_state WHERE game_id=?;";
  try {
    let stateGameArr = await db.all(takeGameState, [idGame]);
    let jsonGameState = stateGameArr[0];
    if (idPlayer != jsonGameState.player_id) {
      let err = "Cannot resume game: Player " + idPlayer + " was not part of game " + idGame;
      res.status(CLIENT_ERROR_CODE).json({
        "error": err
      });
    } else {
      let userName = await db.all("SELECT * FROM players WHERE id=?;", [idPlayer]);
      let thisName = userName[0].name;
      let boardGiven = JSON.parse(jsonGameState.given_scenario_ids);
      let boardResume = [];
      for (let a = 0; a < boardGiven.length; a++) {
        let currentId = boardGiven[a];
        let oneBoardItem = await db.all("SELECT * FROM scenarios WHERE id=?;", [currentId]);
        boardResume.push(oneBoardItem[0]);
      }
      let scenSelected = JSON.parse(jsonGameState.selected_scenario_ids);
      res.json({
        "game_id": idGame,
        "player": {
          "id": idPlayer,
          "name": thisName,
          "board": boardResume,
          "selected_scenarios": scenSelected
        }
      });
    }
  } catch {
    res.status(SERVER_ERROR_CODE).json(SERVER_ERROR_MSG);
  }
});

/**
 * Establishes a database connection to the wpl database and returns the database object.
 * Any errors that occurred should be caught in the function that calls this one.
 * @returns {Object} - The database object for the connection.
 */
async function getDBConnection() {
  const db = await sqlite.open({
    filename: DB_NAME,
    driver: sqlite3.Database
  });
  return db;
}

app.use(express.static('public'));
const PORT = process.env.PORT || 8080;
app.listen(PORT);
