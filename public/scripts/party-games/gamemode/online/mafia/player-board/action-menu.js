(function () {
  function createMafiaPlayerBoardActionMenu({
    openPublicProfileFromPlayerBoard
  }) {
    function closePlayerActionMenus(exceptContainer = null) {
      document.querySelectorAll(".player-container.menu-open").forEach(container => {
        if (container !== exceptContainer) {
          container.classList.remove("menu-open")
        }
      })
    }

    function togglePlayerActionMenu(playerContainer) {
      const isOpen = playerContainer.classList.contains("menu-open")
      closePlayerActionMenus(playerContainer)
      playerContainer.classList.toggle("menu-open", !isOpen)
    }

    function handlePlayerMenuTrigger(event, playerContainer) {
      if (!playerContainer.querySelector(".player-action-menu")) return
      event.stopPropagation()
      togglePlayerActionMenu(playerContainer)
    }

    function handlePlayerMenuTriggerKeydown(event, playerContainer) {
      if (event.key !== "Enter" && event.key !== " ") return

      event.preventDefault()
      handlePlayerMenuTrigger(event, playerContainer)
    }

    function getStoredPlayerBoardAccount() {
      try {
        return JSON.parse(localStorage.getItem("oe-account")) || null
      } catch {
        return null
      }
    }

    function getCurrentPlayerBoardAccountId() {
      const storedAccount = getStoredPlayerBoardAccount()
      return storedAccount?.id || storedAccount?._id || ""
    }

    function canOpenPlayerActionMenu(context = {}) {
      const viewerAccountId = getCurrentPlayerBoardAccountId()
      const targetAccountId = context.accountId || ""

      return Boolean(
        viewerAccountId &&
          targetAccountId &&
          String(viewerAccountId) !== String(targetAccountId)
      )
    }

    function createPlayerActionMenu(context = {}) {
      const menu = document.createElement("div")
      menu.className = "player-action-menu"
      menu.setAttribute("role", "menu")

      const actions = ["Add friend", "View Profile", "Block"]
      actions.forEach(action => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "player-action-menu-button"
        if (action === "Block") {
          button.classList.add("is-danger")
        }
        button.textContent = action
        button.setAttribute("role", "menuitem")
        button.addEventListener("click", event => {
          event.stopPropagation()
          closePlayerActionMenus()
          if (action === "View Profile") {
            openPublicProfileFromPlayerBoard(context)
          }
        })
        menu.appendChild(button)
      })

      menu.addEventListener("click", event => {
        event.stopPropagation()
      })

      return menu
    }

    function makePlayerMenuTrigger(element, playerContainer, label) {
      element.classList.add("player-menu-trigger")
      element.setAttribute("role", "button")
      element.setAttribute("tabindex", "0")
      element.setAttribute("aria-haspopup", "menu")
      element.setAttribute("aria-label", label)
      element.addEventListener("click", event => {
        handlePlayerMenuTrigger(event, playerContainer)
      })
      element.addEventListener("keydown", event => {
        handlePlayerMenuTriggerKeydown(event, playerContainer)
      })
    }

    return {
      canOpenPlayerActionMenu,
      closePlayerActionMenus,
      createPlayerActionMenu,
      makePlayerMenuTrigger
    }
  }

  window.createMafiaPlayerBoardActionMenu = createMafiaPlayerBoardActionMenu
})()
