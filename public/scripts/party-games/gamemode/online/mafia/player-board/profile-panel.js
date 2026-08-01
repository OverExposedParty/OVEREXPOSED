(function () {
  function createMafiaPlayerBoardProfilePanel() {
    function formatProfileStat(value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString() : "0"
    }

    function formatProfileDate(value) {
      if (!value) return "Unknown"

      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return "Unknown"

      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    }

    function closePublicProfilePanel() {
      const dialog = document.querySelector(".player-public-profile-dialog")
      if (!dialog) return
      if (typeof window.closeOeDialog === "function") {
        window.closeOeDialog(dialog)
      } else if (dialog.open) {
        dialog.close()
      }
    }

    function ensurePublicProfilePanel() {
      let dialog = document.querySelector(".player-public-profile-dialog")
      if (dialog) return dialog

      dialog = document.createElement("dialog")
      dialog.className = "player-public-profile-dialog oe-dialog"
      dialog.setAttribute("aria-labelledby", "player-public-profile-title")

      const panel = document.createElement("section")
      panel.className = "player-public-profile"

      const closeButton = document.createElement("button")
      closeButton.type = "button"
      closeButton.className = "player-public-profile-close"
      closeButton.setAttribute("aria-label", "Close profile")
      closeButton.textContent = "X"
      closeButton.addEventListener("click", closePublicProfilePanel)

      const content = document.createElement("div")
      content.className = "player-public-profile-content"

      panel.append(closeButton, content)
      dialog.appendChild(panel)
      document.body.appendChild(dialog)
      window.OeDialog?.register(dialog)

      return dialog
    }

    function setPublicProfilePanelState(content, state, message = "") {
      content.replaceChildren()

      const status = document.createElement("div")
      status.className = `player-public-profile-state ${state}`
      status.textContent = message
      content.appendChild(status)
    }

    async function renderPublicProfile(profile, fallback = {}) {
      const overlay = ensurePublicProfilePanel()
      const content = overlay.querySelector(".player-public-profile-content")
      content.replaceChildren()

      const header = document.createElement("header")
      header.className = "player-public-profile-header"

      const avatar = document.createElement("div")
      avatar.className = "player-public-profile-avatar"
      header.appendChild(avatar)

      const heading = document.createElement("div")
      heading.className = "player-public-profile-heading"

      const title = document.createElement("h2")
      title.id = "player-public-profile-title"
      title.textContent =
        profile.displayName || profile.username || fallback.username || "Player"
      heading.appendChild(title)

      const username = document.createElement("p")
      username.textContent = profile.username || "Player"
      heading.appendChild(username)

      const meta = document.createElement("div")
      meta.className = "player-public-profile-meta"
      ;[
        profile.onlineStatus || "Status hidden",
        `Member since ${formatProfileDate(profile.joinedAt)}`
      ].forEach(label => {
        const item = document.createElement("span")
        item.textContent = label
        meta.appendChild(item)
      })
      heading.appendChild(meta)
      header.appendChild(heading)
      content.appendChild(header)

      await createUserIconPartyGames({
        container: avatar,
        userId: profile.id || fallback.id || "public-profile",
        userCustomisationString:
          profile.oeIcon || fallback.userIcon || "0000:0000:0000:0000"
      })

      if (profile.stats) {
        const stats = document.createElement("div")
        stats.className = "player-public-profile-stats"
        const statItems = [
          ["Level", profile.stats.level || 1],
          ["XP", profile.stats.xp || 0],
          ["Games", profile.stats.gamesPlayed || 0],
          ["Rounds", profile.stats.roundsPlayed || 0]
        ]

        statItems.forEach(([label, value]) => {
          const item = document.createElement("div")
          item.className = "player-public-profile-stat"

          const number = document.createElement("strong")
          number.textContent = formatProfileStat(value)
          item.appendChild(number)

          const caption = document.createElement("span")
          caption.textContent = label
          item.appendChild(caption)

          stats.appendChild(item)
        })
        content.appendChild(stats)
      } else {
        const hiddenStats = document.createElement("div")
        hiddenStats.className = "player-public-profile-state"
        hiddenStats.textContent = "Game stats are hidden"
        content.appendChild(hiddenStats)
      }

      const details = document.createElement("div")
      details.className = "player-public-profile-details"

      const lastMode = document.createElement("p")
      lastMode.textContent = profile.stats?.lastActiveGameMode
        ? `Last played ${profile.stats.lastActiveGameMode}`
        : "No recent game mode"
      details.appendChild(lastMode)

      const achievements = document.createElement("p")
      achievements.textContent = profile.stats
        ? `${formatProfileStat(profile.stats.achievementsUnlocked || 0)} achievements unlocked`
        : "Achievements hidden"
      details.appendChild(achievements)

      content.appendChild(details)
    }

    async function openPublicProfileFromPlayerBoard(context = {}) {
      if (!context.accountId) return

      if (typeof window.openOnlinePublicProfile === "function") {
        window.openOnlinePublicProfile({
          userId: context.id,
          accountId: context.accountId,
          username: context.username,
          userIcon: context.userIcon
        })
        return
      }

      const dialog = ensurePublicProfilePanel()
      const content = dialog.querySelector(".player-public-profile-content")
      if (typeof window.openOeDialog === "function") {
        window.openOeDialog(dialog, {
          initialFocus: ".player-public-profile-close"
        })
      } else if (!dialog.open) {
        dialog.showModal()
      }
      setPublicProfilePanelState(content, "loading", "Loading profile...")

      try {
        const response = await fetch(
          `/api/accounts/public/${encodeURIComponent(context.accountId)}`,
          { credentials: "same-origin" }
        )
        const payload = await response.json().catch(() => ({}))
        const profile = payload?.profile || payload?.data?.profile

        if (!response.ok || !profile) {
          throw new Error(
            payload?.message ||
              payload?.error?.message ||
              "Profile unavailable"
          )
        }

        await renderPublicProfile(profile, context)
      } catch (error) {
        setPublicProfilePanelState(
          content,
          "error",
          error?.message || "Profile unavailable"
        )
      }
    }

    return {
      closePublicProfilePanel,
      openPublicProfileFromPlayerBoard
    }
  }

  window.createMafiaPlayerBoardProfilePanel =
    createMafiaPlayerBoardProfilePanel
})()
