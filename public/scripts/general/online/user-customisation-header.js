const rightHeaderContainer = document.querySelector('.header-icon-container.row.right');
let userCustomisationIconButton;

function getCurrentHeaderCustomisation() {
    const saved = localStorage.getItem("user-customisation");
    console.log(saved);
    if (saved) {
        try {
            const obj = JSON.parse(saved);

            return {
                colour:
                    getFilePathByCustomisationId(obj.colourSlotId) ??
                    blankUserCustomisation.colour,
                headSlot:
                    getFilePathByCustomisationId(obj.headSlotId) ??
                    blankUserCustomisation.headSlot,
                eyesSlot:
                    getFilePathByCustomisationId(obj.eyesSlotId) ??
                    blankUserCustomisation.eyesSlot,
                mouthSlot:
                    getFilePathByCustomisationId(obj.mouthSlotId) ??
                    blankUserCustomisation.mouthSlot,
            };
        } catch (e) {
            // fall through to blank
        }
    }
    console.log(blankUserCustomisation)
    return blankUserCustomisation;
}

function renderUserCustomisationHeaderIcon() {
    if (!userCustomisationIconButton) return;
    userCustomisationIconButton.innerHTML = "";

    const current = getCurrentHeaderCustomisation();
    console.log('Rendering header icon with customisation:', current);
    const stack = CreateImageStack(current);
    userCustomisationIconButton.appendChild(stack);
}

(async () => {
    if (!rightHeaderContainer) return;

    userCustomisationIconButton = document.createElement("div");
    userCustomisationIconButton.classList.add("icon-container");
    userCustomisationIconButton.id = "user-customisation-button";

    rightHeaderContainer.appendChild(userCustomisationIconButton);
    if (typeof syncHeaderIconActiveStates === "function") {
        syncHeaderIconActiveStates();
    }

    userCustomisationIconButton.addEventListener("click", async () => {
        if (permanantElementClassArray.includes(userCustomisationContainer)) return;
        UpdateCustomisation({ initialLoad: true });
        toggleUserCustomisation();
    });

    if (typeof hostedParty !== "undefined" && hostedParty) {
        userCustomisationIconButton.classList.add("disabled");
    }
    await Ready.when('user-customisation-icon', { timeout: 10000 });
    renderUserCustomisationHeaderIcon();
    if (typeof syncHeaderIconActiveStates === "function") {
        syncHeaderIconActiveStates();
    }

    SetScriptLoaded("/scripts/general/online/user-customisation-header.js");
    Ready.set("user-customisation-header", true);
})();
