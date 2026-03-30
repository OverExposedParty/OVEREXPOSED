let devModeUnlocked = false;

const chatLogContainer = document.querySelector('.chat-box');
const chatMessagesContainer = chatLogContainer.querySelector('.chat-messages');
const chatLogInput = chatLogContainer.querySelector('.chat-input input');
const chatInputContainer = chatLogContainer.querySelector('.chat-input');
const chatInputBadge = document.createElement('div');
chatInputBadge.className = 'chat-input-badge';
chatInputContainer.appendChild(chatInputBadge);
chatLogInput.maxLength = 100;
let unreadMessageCount = 0;
let hasInitialChatLogLoaded = false;

function isPortraitMode() {
    return window.innerHeight >= window.innerWidth;
}

function updateUnreadBadge() {
    const showBadge = isPortraitMode() && unreadMessageCount > 0;
    chatInputBadge.textContent = unreadMessageCount > 9 ? '9+' : String(unreadMessageCount);
    chatInputBadge.hidden = !showBadge;
    chatInputBadge.style.display = showBadge ? 'flex' : 'none';
}

function clearUnreadMessages() {
    unreadMessageCount = 0;
    updateUnreadBadge();
}

function setPortraitChatExpanded(isExpanded) {
    if (!isPortraitMode()) return;

    chatLogContainer.classList.toggle("expanded", isExpanded);

    if (isExpanded) {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        clearUnreadMessages();
    }
}

async function DisplayChatLogs() {
    if (!partyCode) return;
    const chatLog = await getPartyChatLog();
    const markUnread = hasInitialChatLogLoaded;

    chatLog.chat.forEach(chat => {
        CreateChatMessage(chat.username, chat.message, chat.eventType, chat.timestamp, { markUnread });
    });

    hasInitialChatLogLoaded = true;
}

function CreateChatMessage(name, message, eventType, timestamp, options = {}) {
    const { markUnread = true } = options;
    if (!chatMessagesContainer || chatMessagesContainer.querySelector(`[data-timestamp="${timestamp}"]`)) return;

    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const chatMessage = document.createElement('p');
    chatMessage.setAttribute('data-timestamp', timestamp);
    chatMessage.classList.add(eventType);
    if (eventType === 'disconnect') {
        chatMessage.classList.add('disconnected');
    } else if (eventType === 'reconnect') {
        chatMessage.classList.add('reconnected');
    }

    chatMessage.textContent = `${timeString} ${name}: ${message}`;
    chatMessage.classList.add('new-message');
    chatMessagesContainer.appendChild(chatMessage);

    const newMessages = chatMessagesContainer.querySelectorAll('.new-message');
    if (newMessages.length > 3) {
        const excess = newMessages.length - 3;
        for (let i = 0; i < excess; i++) {
            newMessages[i].classList.remove('new-message');
        }
    }

    // Remove 'new-message' class after 10 seconds
    setTimeout(() => {
        chatMessage.classList.remove('new-message');
    }, 10000);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    if (markUnread && isPortraitMode() && !chatLogContainer.classList.contains("expanded")) {
        unreadMessageCount += 1;
        updateUnreadBadge();
    }
}

chatLogInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();

        const message = chatLogInput.value.trim();
        if (!message) {
            return;
        }
        else if (message.startsWith("/")) {
            GetCommand(message.toUpperCase());

        }
        else {
            sendPartyChat({
                username: onlineUsername,
                message: message,
                eventType: "message"
            });

        }
        chatLogInput.value = "";
    }
});

function GetCommand(message) {
    const command = parseCommand(message);

    if (command.error) {
        CreateChatMessage("[CONSOLE]", command.error, "error", Date.now());
        return;
    }

    // Always allow the /dev command through
    if (command.command.toLowerCase() === "dev") {
        if (command.action.toLowerCase() === "build-30082025") {
            devModeUnlocked = true;
            CreateChatMessage("[CONSOLE]", "Developer mode unlocked. You may now use commands.", "info", Date.now());
        } else {
            CreateChatMessage("[CONSOLE]", "Invalid dev command.", "error", Date.now());
        }
        return; // stop here
    }

    // For all other commands, block if dev mode isn't unlocked
    if (!devModeUnlocked) {
        CreateChatMessage("[CONSOLE]", "COMMANDS NOT AVAILABLE AT THIS TIME.", "error", Date.now());
        return;
    }

    if (!(hostedParty || hostDeviceId == deviceId)) {
        CreateChatMessage("[CONSOLE]", "You are not the host of this party.", "error", Date.now());
        return;
    }

    const commands = {
        kick: {
            description: "Kick a user from the party. Usage: /kick <userId>",
            run: (cmd) => {
                const user = document.querySelector(`.user-icon[data-user-id="${cmd.action}"]`);
                if (user && cmd.action !== deviceId) {
                    RemoveUserFromParty(cmd.action);
                    user.remove();
                } else {
                    CreateChatMessage("[CONSOLE]", "Cannot kick this user.", "error", Date.now());
                }
            }
        },
        party: {
            description: "Party management. Subcommands: delete, create",
            run: async (cmd) => {
                if (cmd.action?.toLowerCase() === "delete") {
                    DeleteParty();
                    if (typeof onlineButton !== 'undefined') {
                        onlineButton.classList.remove('active');
                        await ToggleOnlineMode(false);
                    }
                }
                else if (cmd.action?.toLowerCase() === "create") {
                    if ((Array.from(packButtons).filter(button => button.classList.contains('active'))).length === 0) {
                        CreateChatMessage("[CONSOLE]", "UNABLE TO CREATE PARTY. NO PACKS SELECTED", "error", Date.now());
                        return;
                    }
                    if (hostedParty == true) {
                        if (onlineButton) {
                            onlineButton.classList.add('active');
                        }
                        await ToggleOnlineMode(true);
                    } else {
                        CreateChatMessage("[CONSOLE]", "UNABLE TO CREATE PARTY. YOU ARE NOT IN GAMEMODE SETTINGS ROOM", "error", Date.now());
                    }
                }
                else if (cmd.action?.toLowerCase() === "skip") {
                    if (isPlaying) {
                        await PartySkip();
                        //CreateChatMessage("[CONSOLE]", "UNABLE TO SKIP. YOU ARE NOT IN A GAME", "error", Date.now());
                    } else {
                        CreateChatMessage("[CONSOLE]", "UNABLE TO SKIP. YOU ARE NOT IN A GAME", "error", Date.now());
                    }
                }
                else {
                    CreateChatMessage("[CONSOLE]", "Invalid party command.", "error", Date.now());
                }
            }
        },
        help: {
            description: "Show a list of available commands.",
            run: () => {
                let helpText = "Available commands:\n";
                for (const [cmd, data] of Object.entries(commands)) {
                    helpText += `- ${cmd}: ${data.description}\n`;
                }
                CreateChatMessage("[CONSOLE]", helpText.trim(), "info", Date.now());
            }
        }
    };

    const handler = commands[command.command.toLowerCase()];
    if (handler) {
        handler.run(command);
    } else {
        CreateChatMessage("[CONSOLE]", "Invalid command.", "error", Date.now());
    }
}

function parseCommand(message) {
    // Match: /command [optional action...]
    const regex = /^\/(\w+)(?:\s+(.+))?$/;
    const match = message.trim().match(regex);

    if (!match) {
        return { error: "Invalid format. Expected /[COMMAND] [ACTION]" };
    }

    return {
        command: match[1],
        action: match[2] || null
    };
}


document.addEventListener("click", (e) => {
    if (isPortraitMode()) {
        setPortraitChatExpanded(chatLogInput.contains(e.target));
        return;
    }

    if (chatLogInput.contains(e.target) || chatMessagesContainer.contains(e.target)) {
        chatLogContainer.classList.add("expanded");
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } else {
        chatLogContainer.classList.remove("expanded");
    }
});

chatLogInput.addEventListener("focus", () => {
    setPortraitChatExpanded(true);
});

window.addEventListener("resize", () => {
    if (!isPortraitMode()) {
        clearUnreadMessages();
    }
    updateUnreadBadge();
});

updateUnreadBadge();

const chatLogCSS = document.createElement('link');
chatLogCSS.rel = 'stylesheet';
chatLogCSS.href = versionAssetUrl("/css/general/online/chat-room.css");
document.head.appendChild(chatLogCSS);
