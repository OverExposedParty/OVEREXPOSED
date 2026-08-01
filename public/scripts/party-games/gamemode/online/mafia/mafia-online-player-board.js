let revealRoleOnDeath = false
let revealRolesToDeadPlayers = false

const playerBoard = document.getElementById("player-board")
const playerBoardButtonContainer = document.getElementById("player-board-button-container")
const playerBoardButton = document.getElementById("player-board-button")

const popUpRoleContainer = document.getElementById("pop-up-role-container")
const popUpRoleHeader = popUpRoleContainer.querySelector(".content-container h1")
const popUpRoleDescription = popUpRoleContainer.querySelector(".content-container h2")

const playerBoardRoleButton = document.querySelector(".player-board-role-btn")

const mafiaPlayerBoardProfilePanel = window.createMafiaPlayerBoardProfilePanel()
const mafiaPlayerBoardActionMenu = window.createMafiaPlayerBoardActionMenu({
  openPublicProfileFromPlayerBoard:
    mafiaPlayerBoardProfilePanel.openPublicProfileFromPlayerBoard
})
const mafiaPlayerBoardRenderer = window.createMafiaPlayerBoardRenderer({
  actionMenu: mafiaPlayerBoardActionMenu,
  getRevealRoleOnDeath: () => revealRoleOnDeath,
  getRevealRolesToDeadPlayers: () => revealRolesToDeadPlayers,
  playerBoard,
  playerBoardButton
})

function renderPlayers(players, boardTitle) {
  return mafiaPlayerBoardRenderer.renderPlayers(players, boardTitle)
}

function UpdatePlayerBoardButton({ userCustomisationString, userId }) {
  return mafiaPlayerBoardRenderer.UpdatePlayerBoardButton({
    userCustomisationString,
    userId
  })
}

function SetPlayerBoardButton({ userCustomisationString, userId }) {
  return mafiaPlayerBoardRenderer.SetPlayerBoardButton({
    userCustomisationString,
    userId
  })
}

function AddDeadEyesToString(userCustomisationString) {
  return mafiaPlayerBoardRenderer.AddDeadEyesToString(userCustomisationString)
}

window.renderPlayers = renderPlayers
window.UpdatePlayerBoardButton = UpdatePlayerBoardButton
window.SetPlayerBoardButton = SetPlayerBoardButton
window.AddDeadEyesToString = AddDeadEyesToString

window.bindMafiaPlayerBoardEvents({
  actionMenu: mafiaPlayerBoardActionMenu,
  closePublicProfilePanel:
    mafiaPlayerBoardProfilePanel.closePublicProfilePanel,
  playerBoard,
  playerBoardButton,
  playerBoardRoleButton,
  popUpRoleContainer
})
