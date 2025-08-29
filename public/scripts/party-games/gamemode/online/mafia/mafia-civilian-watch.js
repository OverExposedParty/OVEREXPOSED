let phaseOne;
let phaseTwo;
let phaseThree;

const maxNumOfPhases = 3;
const maxNumOfDialogues = 3;

let currentPhase = 0;

const selectCivilianWatchContainer = document.getElementById('select-civilian-watch-container');
const selectCivilianWatchHeader = selectCivilianWatchContainer.querySelector('.content-container h1');
const selectCivilianWatchText = selectCivilianWatchContainer.querySelector('.content-container h2');
const selectCivilianWatchOptionContainer = selectCivilianWatchContainer.querySelector('.button-container');
const selectCivilianWatchOptionButtons = selectCivilianWatchOptionContainer.querySelectorAll('button:not(#leave)');
const selectCivilianWatchTimerWrapper = selectCivilianWatchContainer.querySelector('.timer-wrapper')
const selectCivilianWatchLeaveButton = selectCivilianWatchOptionContainer.querySelector('#leave');
const selectCivilianWatchConfirmButton = selectCivilianWatchContainer.querySelector('.select-button-container .select-button')

const displayCivilianWatchResponseContainer = document.getElementById('select-civilian-watch-response-container');
const displayCivilianWatchResponseText = displayCivilianWatchResponseContainer.querySelector('.content-container h2');
const displayCivilianWatchResponseTimerWrapper = displayCivilianWatchResponseContainer.querySelector('.timer-wrapper')

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
    selectCivilianWatchText.textContent = selectedMafiaPhaseDialogues[currentPhase][0];
    for (let i = 0; i < selectCivilianWatchOptionButtons.length; i++) {
        const currentPhaseOptions = selectedmafiaPhaseOptions[currentPhase];
        const optionKeys = Object.keys(currentPhaseOptions);
        const optionKey = optionKeys[i];
        selectCivilianWatchOptionButtons[i].textContent = optionKey;
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
    const currentPartyData = await GetCurrentPartyData();
    const index = currentPartyData.players.findIndex(player => player.computerId === deviceId);
    let updatePartyData = false;
    if (selectCivilianWatchContainer.getAttribute('selected-id') == 'leave') {
        currentPartyData.players[index].hasConfirmed = true;
        await SendInstruction({
            partyData: currentPartyData,
        });
        return;
    }
    phase = getPhases();

    const optionNumber = Number(selectCivilianWatchContainer.getAttribute('selected-id'));

    const selectedOption = phaseOne[optionNumber];
    displayCivilianWatchResponseText.textContent = selectedmafiaPhaseOptions[currentPhase][selectCivilianWatchContainer.getAttribute('data-option')][phase[currentPhase][optionNumber]];

    selectCivilianWatchOptionButtons.forEach(button => {
        button.addEventListener('click', () => {
            button.classList.remove('active');
            selectCivilianWatchContainer.setAttribute('selected-id', "");
        });
    });
    selectCivilianWatchLeaveButton.classList.remove('active');
    
    setActiveContainers(displayCivilianWatchResponseContainer);
    setTimeout(async () => {
        const currentPartyData = await GetCurrentPartyData();
        console.log("selectedOption: ", selectedOption);
        if (selectedOption == phaseOptions[2]) { //success
            currentPhase++;
            CivilianWatchContainerUpdate();
            setActiveContainers(selectCivilianWatchContainer);
            return;
        }
        else if (selectedOption == phaseOptions[1]) { //unclear
            setActiveContainers(waitingForPlayersContainers);
            currentPartyData.players[index].hasConfirmed = true;
            console.log("selectedOption: ", selectedOption);
            updatePartyData = true;
        }
        else if (selectedOption == phaseOptions[0]) { //setback
            setActiveContainers(waitingForPlayersContainers);
            currentPartyData.players[index].hasConfirmed = true;
            console.log("selectedOption: ", selectedOption);
            updatePartyData = true;
        }
        if (currentPhase > 2) {
            setActiveContainers(waitingForPlayersContainers);
        }
        if (updatePartyData == true) {
            await SendInstruction({
                partyData: currentPartyData,
            });
        }
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
