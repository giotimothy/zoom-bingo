"use strict";

/*
 * This .js file is responsible for the front-end behavior of my zoomingo site. It
 * handles all of the user interfaces and the API calls to the back-end. This file
 * allows the user to interact with the site and operates the game functionality.
 */
(function() {
  window.addEventListener("load", initial);
  let GAME_ID_KEY = "game_id";
  let PLAYER_ID_KEY = "player_id";

  /**
   * initial function, called when the page has successfully loaded.
   * Sets all the initial state and behavior of the game.
   * Sets most of the event listeners which shape the overall behavior of the game.
   */
  function initial() {
    id("name").disabled = false;
    id("size-select").disabled = false;
    id("new-game").addEventListener("click", newGame);
    id("size-select").addEventListener("change", populateBoard);
    id("reset").addEventListener("click", resetButtonClicked);
    id("resume").addEventListener("click", resumeButtonClicked);
    id("bingo").addEventListener("click", bingoButtonClicked);
    let gameId = window.localStorage.getItem(GAME_ID_KEY);
    let playerId = window.localStorage.getItem(PLAYER_ID_KEY);
    if ((gameId !== null && playerId !== null) && (!isNaN(gameId) && !isNaN(playerId))) {
      id("resume").disabled = false;
    } else {
      id("resume").disabled = true;
    }
  }

  /**
   * resetButtonClicked function, called when the reset button is clicked.
   * Upon reset, this function will disable and enable buttons appropriately.
   * Clears the game state previously stored in localStorage of the site upon reset.
   */
  function resetButtonClicked() {
    id("new-game").disabled = false;
    id("name").disabled = false;
    id("size-select").disabled = false;
    id("board").innerHTML = "";
    id("error").textContent = "";
    id("resume").disabled = true;
    id("message").textContent = "";
    window.localStorage.clear();
  }

  /**
   * resumeButtonClicked function, called when the resume button is clicked.
   * Calls and API to the back-end to fetch the most recent game state.
   * Lets the user to play on the most recent game state if available.
   */
  function resumeButtonClicked() {
    id("resume").disabled = true;
    let thisGameId = window.localStorage.getItem(GAME_ID_KEY);
    let thisPlayerId = window.localStorage.getItem(PLAYER_ID_KEY);
    fetch('/resumeGame?game_id=' + thisGameId + '&player_id=' + thisPlayerId)
      .then(checkStatus)
      .then(response => response.json())
      .then(processResumeGameResp)
      .catch(handleFetchError);
  }

  /**
   * processResumeGameResp function, called to process json returned by resumeGame.
   * Display the most recent game state available.
   * Lets the player continue playing on this game state.
   * @param {JSON} resumeGameJson - a JSON representing the most recent game state
   */
  function processResumeGameResp(resumeGameJson) {
    let jsonOfPlayer = resumeGameJson.player;
    let resumedBoardArray = jsonOfPlayer.board;
    id("size-select").value = resumedBoardArray.length;
    id("name").value = jsonOfPlayer.name;
    id("name").disabled = true;
    id("size-select").disabled = true;
    populateBoard();
    displayAllScenario(resumedBoardArray);
    let selectedScenarioIdArray = jsonOfPlayer.selected_scenarios;
    for (let i = 0; i < selectedScenarioIdArray.length; i++) {
      let oneSelectedScenario = id(selectedScenarioIdArray[i]);
      let oneSelectedDiv = oneSelectedScenario.parentNode;
      oneSelectedDiv.classList.add("selected");
    }
  }

  /**
   * bingoButtonClicked function, called when the BINGO! button is clicked.
   * Calls an API to the back-end to validate whether or not the game is won.
   * Display a message to the player about whether or not the game has a winner.
   */
  function bingoButtonClicked() {
    id("name").disabled = false;
    id("size-select").disabled = false;
    id("message").textContent = "";
    id("error").textContent = "";
    let bingoParams = new FormData();
    let currentGameId = window.localStorage.getItem(GAME_ID_KEY);
    bingoParams.append("game_id", currentGameId);
    fetch('/bingo', {method: "POST", body: bingoParams})
      .then(checkStatus)
      .then(response => response.json())
      .then(processBingoResp)
      .catch(handleFetchError);
  }

  /**
   * processBingoResp function, called to process returned JSON from /bingo
   * Process the returned JSON from the back-end.
   * Decides whether or not the game has been won.
   * Displays the message to the player whether or not the game has been won.
   * @param {JSON} bingoJson - a JSON to determine the winner of the game.
   */
  function processBingoResp(bingoJson) {
    let returnedWinner = bingoJson.winner;
    if (returnedWinner !== null) {
      id("message").textContent = "Well Done! You won the game..!";
      let allCurrentScenarioArray = qsa("#board p");
      for (let i = 0; i < allCurrentScenarioArray.length; i++) {
        let singleScenario = allCurrentScenarioArray[i];
        singleScenario.removeEventListener("click", thisScenarioIsClicked);
      }
      id("name").disabled = false;
      id("size-select").disabled = false;
      id("new-game").disabled = false;
    } else {
      id("message").textContent = "Nobody won...";
      setTimeout(function() {
        id("message").textContent = "";
      }, 3000);
    }
  }

  /**
   * newGame function, called when the new-game button is clicked.
   * Make sure there is a name and a board size entered.
   * Calls an API to the back-end to get a new game.
   */
  function newGame() {
    id("message").textContent = "";
    id("resume").disabled = true;
    id("error").textContent = "";
    let userNameInput = id("name").value;
    let boardSize = id("size-select").value;
    if (userNameInput.trim() === "" || boardSize === 0) {
      id("error").textContent = "Please have your name entered and a board size selected!";
    } else {
      id("name").disabled = true;
      id("size-select").disabled = true;
      id("new-game").disabled = true;
      id("error").textContent = "";
      fetch('/newGame?name=' + userNameInput + '&size=' + boardSize)
        .then(checkStatus)
        .then(response => response.json())
        .then(processGameResponse)
        .catch(handleFetchError);
    }
  }

  /**
   * processNewGameResponse function, called in the .fetch chain of /newGame
   * Process the JSON returned and use those data to create a new game for the user.
   * Display the new game which allows the user to start interacting with the game.
   * @param {JSON} gameJson - a JSON containing all the information for a new game.
   */
  function processGameResponse(gameJson) {
    let newGameId = gameJson.game_id;
    window.localStorage.setItem(GAME_ID_KEY, newGameId);
    let playerJson = gameJson.player;
    let playerId = playerJson.id;
    window.localStorage.setItem(PLAYER_ID_KEY, playerId);
    let boardArray = playerJson.board;
    populateBoard();
    displayAllScenario(boardArray);
  }

  /**
   * displayAllScenario function, called to display all scenario to the cards.
   * Process the given array which contains JSONs.
   * One JSON in that array contains data for one card in that game.
   * This function lets each of the text scenario to be displayed in each card.
   * @param {Array} boardArrayOfJson - an Array containing data for the bingo board.
   */
  function displayAllScenario(boardArrayOfJson) {
    let allSquareArray = qsa("#board > div");
    let requiredNumberOfCards = allSquareArray.length;
    if (boardArrayOfJson.length < requiredNumberOfCards) {
      id("error").textContent = "An error in the server has occurred! Please try again later.";
    } else {
      for (let i = 0; i < requiredNumberOfCards; i++) {
        let oneScenario = gen("p");
        oneScenario.classList.add("scenario");
        oneScenario.addEventListener("click", thisScenarioIsClicked);
        let oneCardJson = boardArrayOfJson[i];
        oneScenario.textContent = oneCardJson.text;
        oneScenario.id = oneCardJson.id;
        allSquareArray[i].appendChild(oneScenario);
      }
    }
  }

  /**
   * thisScenarioIsClicked function, called when a particular scenario is clicked
   * * Retrieve the scenario that has been clicked by the user.
   * Calls an API to the back-end to let it know that this scenario has been selected.
   */
  function thisScenarioIsClicked() {
    let selectedScenarioElement = this;
    selectedScenarioElement.removeEventListener("click", thisScenarioIsClicked);
    let idOfThisScenario = selectedScenarioElement.id;
    let selectScenarioParams = new FormData();
    let gameId = window.localStorage.getItem(GAME_ID_KEY);
    selectScenarioParams.append("game_id", gameId);
    selectScenarioParams.append("scenario_id", idOfThisScenario);
    fetch('/selectScenarios', {method: "POST", body: selectScenarioParams})
      .then(checkStatus)
      .then(response => response.json())
      .then(processSelectScenarioResp)
      .catch(handleFetchError);
  }

  /**
   * processSelectScenarioResp function, called to process selectScenario resp
   * Display a color change to let the player know that this scenario has been selected.
   * @param {JSON} selectScenarioJson - a JSON containing information about the selected scenario.
   */
  function processSelectScenarioResp(selectScenarioJson) {
    let selectedId = selectScenarioJson.scenario_id;
    let divOfThis = id(selectedId).parentNode;
    divOfThis.classList.add("selected");
  }

  /**
   * populateBoard function, called when there is a change in the board size selection.
   * Retrieves the current selected board size from the DOM.
   * Displays the correct number of card containers in the board.
   */
  function populateBoard() {
    id("board").innerHTML = "";
    let numberOfCards = id("size-select").value;
    let squareClass = "";
    if (numberOfCards === "9") {
      squareClass = "three";
    } else if (numberOfCards === "25") {
      squareClass = "five";
    } else if (numberOfCards === "49") {
      squareClass = "seven";
    } else {
      squareClass = "nine";
    }
    for (let i = 0; i < numberOfCards; i++) {
      let oneSquare = gen("div");
      oneSquare.classList.add("square");
      oneSquare.classList.add(squareClass);
      id("board").appendChild(oneSquare);
    }
  }

  /**
   * handleFetchError function, called inside the .catch in the fetch chain
   * Displays the error message contained in the JSON to the player.
   * @param {JSON} err - a JSON containing an error message.
   */
  function handleFetchError(err) {
    id("error").textContent = err;
  }

  // --------------------------- Helper functions ---------------------------

  /**
   * Checks whether or not the response from the fetch call is ok.
   * @param {object} res - The response object from the fetch call.
   * @returns {object} The resp object from the fetch call.
   */
  async function checkStatus(res) {
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return res;
  }

  /**
   * Returns the DOM object with the given id attribute.
   * @param {string} idName - element ID
   * @returns {object} DOM object associated with id (null if not found).
   */
  function id(idName) {
    return document.getElementById(idName);
  }

  /**
   * Returns an array of DOM objects that match the given selector.
   * @param {string} selector - query selector
   * @returns {object[]} array of DOM objects matching the query.
   */
  function qsa(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Returns a new element with the given tag name.
   * @param {string} tagName - HTML tag name for new DOM element.
   * @returns {object} New DOM object for given HTML tag.
   */
  function gen(tagName) {
    return document.createElement(tagName);
  }
})();
