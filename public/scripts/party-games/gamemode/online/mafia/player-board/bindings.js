(function () {
  function bindMafiaPlayerBoardEvents({
    actionMenu,
    closePublicProfilePanel,
    playerBoard,
    playerBoardButton,
    playerBoardRoleButton,
    popUpRoleContainer
  }) {
    playerBoardButton.addEventListener("click", () => {
      if (permanantElementClassArray.includes(playerBoard)) return
      toggleClass(playerBoard, settingsElementClassArray)
    })

    playerBoardRoleButton.addEventListener("click", event => {
      event.stopPropagation()
      toggleClass(popUpRoleContainer, popUpClassArray)
    })

    playerBoard.addEventListener("click", event => {
      if (!event.target.closest(".player-action-menu, .player-menu-trigger")) {
        actionMenu.closePlayerActionMenus()
      }
      hideContainer(popUpRoleContainer)
      removeElementIfExists(popUpClassArray, popUpRoleContainer)
    })

    document.addEventListener("click", event => {
      if (!event.target.closest(".player-container")) {
        actionMenu.closePlayerActionMenus()
      }
    })

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        actionMenu.closePlayerActionMenus()
        closePublicProfilePanel()
      }
    })
  }

  window.bindMafiaPlayerBoardEvents = bindMafiaPlayerBoardEvents
})()
