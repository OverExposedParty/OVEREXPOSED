let phaseOne;
let phaseTwo;
let phaseThree;

const maxNumOfPhases = 3;
const maxNumOfDialogues = 3;

let currentPhase = 0;

gameContainers.push(selectCivilianWatchContainer, displayCivilianWatchResponseContainer);

const dialogueDelay = 4000;

const phaseOptions = ["setback", "unclear", "success"];

const mafiaPhaseOneDialogue = [
    "You step outside, heart pounding. The town sleeps, but you cannot. Where will you go?",
    "The night air is cold and still. Danger feels close, but so does the truth.",
    "Something isn’t right tonight. You tighten your coat and take your first step into the unknown.",
    "The streets are empty, but you feel eyes on you. Time to choose your path.",
    "A chill runs down your spine. You don’t know what you’ll find, but you know you have to look.",
    "You light a cigarette with shaky hands. There’s no turning back now. Where to first?"
];

const mafiaPhaseTwoDialogue = [
    "A shadow crosses a window. You hear movement nearby. Where do you hide to get a better look?",
    "Someone’s out there. You need a vantage point — fast.",
    "Footsteps echo too close for comfort. You duck into the darkness.",
    "A car door slams in the distance. Whoever it was, they’re not alone.",
    "Voices whisper through the wind. You have seconds to act.",
    "Your breath fogs in the cold air. Something — or someone — just moved."
];

const mafiaPhaseThreeDialogue = [
    "You hold your breath. Someone is out there. But what are they doing — and to whom?",
    "You peer through the dark. The figure moves strangely. You can't look away.",
    "A scream is cut short. You see two silhouettes… and only one walks away.",
    "They’re speaking in hushed tones. You catch a name — one you recognize.",
    "The truth begins to take shape. But so does the danger.",
    "You see a glint of metal. Something terrible is about to happen — or already has."
];


const mafiaPhaseOneOptions = {
    "Down the alley": {
        success: "You sneak past empty houses and find a quiet path forward.",
        unclear: "You walk for a while but don’t see anything suspicious.",
        setback: "A raccoon knocks over a bin and startles you. You run back home."
    },
    "Through the woods": {
        success: "You spot a lantern flicker in the distance. Someone’s out there.",
        unclear: "You hear branches crack, but it might’ve just been the wind.",
        setback: "You trip on a root and sprain your ankle. You return limping."
    },
    "Along the river": {
        success: "You see wet footprints near the water. You're on the right trail.",
        unclear: "The river glows in moonlight, but nothing stirs tonight.",
        setback: "You slip on a mossy rock and fall. You're too soaked to continue."
    }
};

const mafiaPhaseTwoOptions = {
    "Behind a fence": {
        success: "Perfect view. You spot someone lingering at a doorstep.",
        unclear: "You hear footsteps, but you can’t see who it was.",
        setback: "You lean too hard on the fence and it creaks. Lights come on."
    },
    "Under the porch": {
        success: "You hear whispered voices. Something’s going down.",
        unclear: "It’s dusty and dark. Nothing stands out.",
        setback: "A stray dog under the porch barks and gives you away."
    },
    "In a tree": {
        success: "You get the high ground and spot two people sneaking around.",
        unclear: "You hear hushed talking… too far to understand.",
        setback: "You snap a branch and nearly fall. Abort mission."
    }
};

const mafiaPhaseThreeOptions = {
    "Peek now": {
        success: "You catch a glimpse of a cloaked figure near [Player X]’s house.",
        unclear: "Someone was there… but they vanished too quickly.",
        setback: "You peek too early. They spot you and vanish into the shadows."
    },
    "Wait for movement": {
        success: "Patience pays off — you clearly see someone approach [Player X].",
        unclear: "You waited… but maybe too long. The street is empty now.",
        setback: "You nod off briefly. By the time you react, it’s too late."
    },
    "Move closer": {
        success: "You step forward silently and overhear a name whispered.",
        unclear: "You get closer but can’t make out what’s going on.",
        setback: "You kick a bottle. They freeze — and vanish. You've been made."
    }
};

const mafiaCivilianDialogues = [
    mafiaPhaseOneDialogue,
    mafiaPhaseTwoDialogue,
    mafiaPhaseThreeDialogue
];

const mafiaPhaseOptions = [
    mafiaPhaseOneOptions,
    mafiaPhaseTwoOptions,
    mafiaPhaseThreeOptions
];

let phase = [];

let selectedMafiaPhaseDialogues = [];
let selectedMafiaPhaseOneDialogue = [];
let selectedMafiaPhaseTwoDialogue = [];
let selectedMafiaPhaseThreeDialogue = [];

let selectedmafiaPhaseOptions = [];
let selectedmafiaPhaseOneOptions = [];
let selectedmafiaPhaseTwoOptions = [];
let selectedmafiaPhaseThreeOptions = [];


function randomizePhase(options) {
    const shuffled = options.sort(() => 0.5 - Math.random());
    return shuffled;
}

function getRandomOptions(arrayLength, numToReturn) {
    if (numToReturn > arrayLength) {
        throw new Error("numToReturn cannot be greater than arrayLength.");
    }

    const numbers = Array.from({ length: arrayLength }, (_, i) => i);

    // Shuffle the array using Fisher-Yates shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, numToReturn);
}

function selectOptions(source, randomIndexes) {
    if (Array.isArray(source)) {
        return randomIndexes.map(i => source[i]);
    } else {
        const keys = Object.keys(source);
        let selected = {};
        for (let i of randomIndexes) {
            const key = keys[i];
            selected[key] = source[key];
        }
        return selected;
    }
}

function InitializeCivilianWatch() {
    selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('disabled'));
    currentPhase = 0;
    phaseOne = randomizePhase([phaseOptions[1], phaseOptions[1], phaseOptions[2]]);
    phaseTwo = randomizePhase([...phaseOptions]);
    phaseThree = randomizePhase([phaseOptions[2], phaseOptions[0], phaseOptions[0]]);

    selectedMafiaPhaseOneDialogue = selectOptions(mafiaPhaseOneDialogue, getRandomOptions(mafiaPhaseOneDialogue.length, maxNumOfDialogues));
    selectedMafiaPhaseTwoDialogue = selectOptions(mafiaPhaseTwoDialogue, getRandomOptions(mafiaPhaseTwoDialogue.length, maxNumOfDialogues));
    selectedMafiaPhaseThreeDialogue = selectOptions(mafiaPhaseThreeDialogue, getRandomOptions(mafiaPhaseThreeDialogue.length, maxNumOfDialogues));
    selectedMafiaPhaseDialogues = [selectedMafiaPhaseOneDialogue, selectedMafiaPhaseTwoDialogue, selectedMafiaPhaseThreeDialogue];

    selectedmafiaPhaseOneOptions = selectOptions(mafiaPhaseOneOptions, getRandomOptions(Object.keys(mafiaPhaseOneOptions).length, maxNumOfPhases));
    selectedmafiaPhaseTwoOptions = selectOptions(mafiaPhaseTwoOptions, getRandomOptions(Object.keys(mafiaPhaseTwoOptions).length, maxNumOfPhases));
    selectedmafiaPhaseThreeOptions = selectOptions(mafiaPhaseThreeOptions, getRandomOptions(Object.keys(mafiaPhaseThreeOptions).length, maxNumOfPhases));
    selectedmafiaPhaseOptions = [selectedmafiaPhaseOneOptions, selectedmafiaPhaseTwoOptions, selectedmafiaPhaseThreeOptions];
    CivilianWatchContainerUpdate();
    setActiveContainers(selectCivilianWatchContainer);
}

function CivilianWatchContainerUpdate() {
    if (!selectedMafiaPhaseDialogues[currentPhase] || !selectedMafiaPhaseDialogues[currentPhase][0]) {
        console.warn("Dialogue not found for currentPhase:", currentPhase, selectedMafiaPhaseDialogues);
        return;
    }

    selectCivilianWatchText.textContent = selectedMafiaPhaseDialogues[currentPhase][0];

    const currentPhaseOptions = selectedmafiaPhaseOptions[currentPhase];
    if (!currentPhaseOptions) {
        console.warn("Options not found for currentPhase:", currentPhase, selectedmafiaPhaseOptions);
        return;
    }

    const optionKeys = Object.keys(currentPhaseOptions);
    for (let i = 0; i < selectCivilianWatchOptionButtons.length; i++) {
        const optionKey = optionKeys[i];
        if (optionKey) {
            selectCivilianWatchOptionButtons[i].textContent = optionKey;
        } else {
            selectCivilianWatchOptionButtons[i].textContent = "";
        }
    }
}


selectCivilianWatchOptionButtons.forEach(button => {
    button.addEventListener('click', () => {
        selectCivilianWatchOptionButtons.forEach(btn => btn.classList.remove('active'));
        selectCivilianWatchLeaveButton.classList.remove('active');
        button.classList.add('active');
        selectCivilianWatchContainer.setAttribute('selected-id', button.getAttribute('id'));
        selectCivilianWatchContainer.setAttribute('data-option', button.textContent);
    });
});


selectCivilianWatchConfirmButton.addEventListener('click', async () => {
    const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
    let updatePartyData = false;

    // Handle leave option
    if (selectCivilianWatchContainer.getAttribute('selected-id') == 'leave') {
        selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.add('disabled'));
        currentPartyData.players[index].hasConfirmed = true;
        currentPartyData.players[index].isReady = true;
        await SendInstruction({
            partyData: currentPartyData,
        });
        return;
    }

    // Prevent double clicks
    selectCivilianWatchConfirmButton.disabled = true;

    // Get current phase
    phase = getPhases()[currentPhase];

    // Get selected option index and option key
    const optionNumber = Number(selectCivilianWatchContainer.getAttribute('selected-id'));
    const optionKey = selectCivilianWatchContainer.getAttribute('data-option');

    // The selected outcome type ("success", "unclear", or "setback")
    const selectedOption = phase[optionNumber];

    // Display the correct outcome text
    displayCivilianWatchResponseText.textContent =
        selectedmafiaPhaseOptions[currentPhase][optionKey][selectedOption];

    // Clean up button states
    selectCivilianWatchOptionButtons.forEach(btn => btn.classList.remove('active'));
    selectCivilianWatchLeaveButton.classList.remove('active');

    console.log("currentPhase:", currentPhase);
    console.log("selectedOption:", selectedOption);

    // Switch to response container
    setActiveContainers(displayCivilianWatchResponseContainer);

    // Wait for the dialogue delay before continuing
    setTimeout(async () => {
        const currentPartyData = await GetCurrentPartyData();

        if (selectedOption === phaseOptions[2]) { // success
            currentPhase++;
            console.log("Success! Moving to next phase:", currentPhase);

            if (currentPhase < maxNumOfPhases) {
                CivilianWatchContainerUpdate();
                setActiveContainers(selectCivilianWatchContainer);
            } else {
                console.log("All phases complete.");
                selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.add('disabled'));
            }

            selectCivilianWatchConfirmButton.disabled = false;
            return;
        }

        if (selectedOption === phaseOptions[1] || selectedOption === phaseOptions[0]) { // unclear or setback
            selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.add('disabled'));
            currentPartyData.players[index].hasConfirmed = true;
            updatePartyData = true;
            console.log("Updating party data due to:", selectedOption);
        }

        if (currentPhase > 2) {
            selectCivilianWatchContainer.querySelectorAll('button').forEach(btn => btn.classList.add('disabled'));
        }

        if (updatePartyData) {
            await SendInstruction({
                partyData: currentPartyData,
            });
        }

        setActiveContainers(selectCivilianWatchContainer);
        selectCivilianWatchConfirmButton.disabled = false;
    }, dialogueDelay);
});


selectCivilianWatchLeaveButton.addEventListener('click', () => {
    selectCivilianWatchOptionButtons.forEach(btn => btn.classList.remove('active'));
    selectCivilianWatchLeaveButton.classList.add('active');
    selectCivilianWatchContainer.setAttribute('selected-id', selectCivilianWatchLeaveButton.getAttribute('id'));
});


function getPhases() {
    return [phaseOne, phaseTwo, phaseThree];
}
