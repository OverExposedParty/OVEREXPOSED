function createVoteButton(playerDeviceId, playerName, phase) {
  // Uses your existing factory, so id, classes, etc stay consistent
  const userButton = createUserButton(playerDeviceId, playerName);

  // Use classes instead of duplicate IDs
  const spanHover = document.createElement('span');
  spanHover.classList.add('hover-count');
  spanHover.textContent = '0';

  const spanConfirmed = document.createElement('span');
  spanConfirmed.classList.add('confirmed-count');
  spanConfirmed.textContent = '0';

  // Differences in spacing/brackets between day/night
  const prefix = phase === 'day' ? '[' : ' [';
  const suffix = phase === 'day' ? ']' : '] ';

  userButton.appendChild(document.createTextNode(prefix));
  userButton.appendChild(spanHover);
  userButton.appendChild(document.createTextNode(', '));
  userButton.appendChild(spanConfirmed);
  userButton.appendChild(document.createTextNode(suffix));

  return userButton;
}

function wireUpVoteButtons() {
  const selectUserVoteDayPlayerButtons =
    selectUserDayPhaseButtonContainer.querySelectorAll('button');
  const selectUserVoteNightPlayerButtons =
    selectUserNightPhaseButtonContainer.querySelectorAll('button');

  selectUserVoteDayPlayerButtons.forEach(button => {
    button.onclick = async () => {
      selectUserVoteDayPlayerButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      selectUserDayPhaseContainer.setAttribute('selected-id', button.getAttribute('id'));
      await SetVote({
        option: selectUserDayPhaseContainer.getAttribute('selected-id'),
        hover: true
      });
    };
  });

  selectUserVoteNightPlayerButtons.forEach(button => {
    button.onclick = async () => {
      selectUserVoteNightPlayerButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      selectUserNightPhaseContainer.setAttribute('selected-id', button.getAttribute('id'));
      await SetVote({
        option: selectUserNightPhaseContainer.getAttribute('selected-id'),
        hover: true
      });
    };
  });

  if (selectUserNightPhaseButtonContainer.querySelectorAll('button').length > 4) {
    selectUserNightPhaseContainer.classList.add('overflow');
  } else {
    selectUserNightPhaseContainer.classList.remove('overflow');
  }
}

function syncPlayerButtonsWithParty(party) {
  // Alive players set for quick lookup
  const aliveIds = new Set(
    party.players
      .filter(p => p.state.status === 'alive')
      .map(p => p.identity.computerId)
  );

  // --- DAY CONTAINER: everyone alive (including yourself) ---

  // Remove buttons for players that are no longer alive
  Array.from(selectUserDayPhaseButtonContainer.querySelectorAll('button'))
    .forEach(button => {
      const id = button.getAttribute('id');
      if (!aliveIds.has(id)) {
        button.remove();
      }
    });

  // Add missing buttons for newly alive players
  party.players.forEach(player => {
    const playerDeviceId = player.identity.computerId;
    const playerName = player.identity.username;

    if (!aliveIds.has(playerDeviceId)) return;

    const existingButton = selectUserDayPhaseButtonContainer
      .querySelector(`button[id="${playerDeviceId}"]`);

    if (!existingButton) {
      const newButton = createVoteButton(playerDeviceId, playerName, 'day');
      selectUserDayPhaseButtonContainer.appendChild(newButton);
    }
  });

  // --- NIGHT CONTAINER: other alive civilians only ---

  // Remove buttons whose player is no longer a valid night target
  Array.from(selectUserNightPhaseButtonContainer.querySelectorAll('button'))
    .forEach(button => {
      const id = button.getAttribute('id');
      const player = party.players.find(p => p.identity.computerId === id);

      const validNightTarget =
        player &&
        player.identity.computerId !== deviceId &&
        player.state.status === 'alive' &&
        civilianRoles.includes(player.state.role);

      if (!validNightTarget) {
        button.remove();
      }
    });

  // Add missing buttons for valid night targets
  party.players.forEach(player => {
    const playerDeviceId = player.identity.computerId;
    const playerName = player.identity.username;

    const validNightTarget =
      playerDeviceId !== deviceId &&
      player.state.status === 'alive' &&
      civilianRoles.includes(player.state.role);

    if (!validNightTarget) return;

    const existingButton = selectUserNightPhaseButtonContainer
      .querySelector(`button[id="${playerDeviceId}"]`);

    if (!existingButton) {
      const newButton = createVoteButton(playerDeviceId, playerName, 'night');
      selectUserNightPhaseButtonContainer.appendChild(newButton);
    }
  });

  // Re-wire listeners + overflow state after the DOM changes
  wireUpVoteButtons();
}