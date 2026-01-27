let revealRoleOnDeath = false
let revealRolesToDeadPlayers = false

const playerBoard = document.getElementById("player-board")
const playerBoardButtonContainer = document.getElementById("player-board-button-container")
const playerBoardButton = document.getElementById("player-board-button")

const popUpRoleContainer = document.getElementById("pop-up-role-container")
const popUpRoleHeader = popUpRoleContainer.querySelector(".content-container h1")
const popUpRoleDescription = popUpRoleContainer.querySelector(".content-container h2")

const playerBoardRoleButton = document.querySelector(".player-board-role-btn")

function normalizePlayers(players) {
  const list = Array.isArray(players) ? players : Object.values(players)

  return list
    .map(player => ({
      id: player?.identity?.computerId ?? "",
      role: player?.state?.role ?? "",
      username: player?.identity?.username ?? "",
      status: player?.state?.status ?? "",
      userIcon: player?.identity?.userIcon ?? ""
    }))
    .filter(p => p.id)
}

function ensureBoardTitle(board, boardTitle) {
  let titleEl = board.querySelector(".player-board-title")
  if (!titleEl) {
    titleEl = document.createElement("div")
    titleEl.className = "player-board-title"
    board.prepend(titleEl)
  }
  titleEl.textContent = boardTitle
}

function ensurePlayersContainer(board) {
  let container = board.querySelector(".players-container")
  if (!container) {
    container = document.createElement("div")
    container.className = "players-container"
    board.appendChild(container)
  }
  return container
}

function selectPlayerContainer(parent, id) {
  const safeId = window.CSS && CSS.escape ? CSS.escape(id) : id
  return parent.querySelector(`.player-container[data-player-id="${safeId}"]`)
}

async function createPlayerContainer({ role, username, status, id, userIcon, mePlayer }) {
  const playerContainer = document.createElement("div")
  playerContainer.className = "player-container"
  playerContainer.setAttribute("data-player-id", id)

  const roleText = document.createElement("div")
  roleText.className = "player-inner-text-role"

  if (mePlayer?.identity?.computerId === id) {
    roleText.textContent = role || "N/A"
  } else if (revealRoleOnDeath && status === "dead") {
    roleText.textContent = role || "N/A"
  } else if (mePlayer?.state?.status === "dead" && revealRolesToDeadPlayers) {
    roleText.textContent = role || "N/A"
  } else {
    roleText.textContent = "?????"
  }

  playerContainer.appendChild(roleText)

  let finalIcon = userIcon || "0000:0000:0000:0000"

  if (status === "dead") {
    playerContainer.classList.add("dead")
    playerBoard.classList.add("dead")
    finalIcon = AddDeadEyesToString(finalIcon)
  }

  await createUserIconPartyGames({
    container: playerContainer,
    userId: id,
    userCustomisationString: finalIcon,
    size: "large"
  })

  const info = document.createElement("div")
  info.className = "player-info"

  const userContainer = document.createElement("div")
  userContainer.className = "player-username"

  const userValue = document.createElement("span")
  userValue.className = "value"
  userValue.textContent = ` ${username}`
  userContainer.appendChild(userValue)
  info.appendChild(userContainer)

  const statusContainer = document.createElement("div")
  statusContainer.className = "player-status"

  const statusValue = document.createElement("span")
  statusValue.className = "value"
  statusValue.textContent = ` ${status}`
  statusContainer.appendChild(statusValue)
  info.appendChild(statusContainer)

  playerContainer.appendChild(info)

  return playerContainer
}

function updatePlayerContainer(container, { role, username, status, id, userIcon }) {
  const roleText = container.querySelector(".player-inner-text-role")
  if (roleText && roleText.textContent !== role) {
    roleText.textContent = role || "N/A"
  }

  const userValue = container.querySelector(".player-username .value")
  if (userValue && userValue.textContent.trim() !== username) {
    userValue.textContent = ` ${username}`
  }

  const statusValue = container.querySelector(".player-status .value")
  if (statusValue && statusValue.textContent.trim() !== status) {
    statusValue.textContent = ` ${status}`
  }

  if (status === "dead") {
    container.classList.add("dead")
    const deadIcon = AddDeadEyesToString(userIcon || "0000:0000:0000:0000")
    EditUserIconPartyGames({
      container,
      userId: id,
      userCustomisationString: deadIcon
    })
  }
}

async function upsertPlayerContainer(parent, player) {
  let container = selectPlayerContainer(parent, player.id)

  if (!container) {
    container = await createPlayerContainer({
      role: player.role,
      username: player.username,
      status: player.status,
      id: player.id,
      userIcon: player.userIcon,
      mePlayer: currentPartyData.players.find(p => p.identity.computerId === deviceId)
    })
    parent.appendChild(container)
  } else {
    updatePlayerContainer(container, player)
  }
}

function removeStaleContainers(parent, validIdsSet) {
  const existingContainers = parent.querySelectorAll(".player-container")
  existingContainers.forEach(container => {
    const id = container.getAttribute("data-player-id")
    if (!validIdsSet.has(id)) container.remove()
  })
}

function renderPlayers(players, boardTitle) {
  const index = currentPartyData.players.findIndex(p => p.identity.computerId === deviceId)
  const board = document.getElementById("player-board")
  if (!board) return

  ensureBoardTitle(board, boardTitle)
  const playersContainer = ensurePlayersContainer(board)

  const normalizedPlayers = normalizePlayers(players)
  const validIds = new Set()

  normalizedPlayers.forEach(player => {
    validIds.add(player.id)
    upsertPlayerContainer(playersContainer, player)
  })

  removeStaleContainers(playersContainer, validIds)

  const myPlayer = players[index]
  const myIcon = myPlayer?.identity?.userIcon
  const myStatus = myPlayer?.state?.status

  if (myStatus === "dead") {
    SetPlayerBoardButtonDead(myIcon)
  } else {
    UpdatePlayerBoardButton({
      userCustomisationString: myIcon,
      userId: myPlayer?.identity?.computerId
    })
  }
}

function UpdatePlayerBoardButton({ userCustomisationString, userId }) {
  if (!userCustomisationString || !userId) return
  EditUserIconPartyGames({
    container: playerBoardButton,
    userId: userId,
    userCustomisationString: userCustomisationString
  })
}

function SetPlayerBoardButton({ userCustomisationString, userId }) {
  if (!userCustomisationString || !userId) return
  createUserIconPartyGames({
    container: playerBoardButton,
    userId,
    userCustomisationString
  })
}

playerBoardButton.addEventListener("click", () => {
  if (permanantElementClassArray.includes(playerBoard)) return
  toggleClass(playerBoard, settingsElementClassArray)
})

function SetPlayerBoardButtonDead(userCustomisationString) {
  playerBoardButton.classList.add("dead")
  EditUserIconPartyGames({
    container: playerBoardButton,
    userId: deviceId,
    userCustomisationString: AddDeadEyesToString(userCustomisationString)
  })
}

function AddDeadEyesToString(userCustomisationString) {
  const parsed = parseCustomisationString(userCustomisationString)
  parsed.eyes = "A202"
  return `${parsed.colour}:${parsed.head}:${parsed.eyes}:${parsed.mouth}`
}

playerBoardRoleButton.addEventListener("click", event => {
  event.stopPropagation()
  toggleClass(popUpRoleContainer, popUpClassArray)
})

playerBoard.addEventListener("click", () => {
  popUpRoleContainer.classList.remove("active")
  removeElementIfExists(popUpClassArray, popUpRoleContainer)
})
