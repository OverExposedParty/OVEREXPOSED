const drinkWheelContainer = document.querySelector('#drink-wheel-container');


let spinning = false;
let spinDisabled = false;

if (placeholderGamemodeAddons?.dataset.online === "false") {
    console.log(spinButton);
    if (spinButton) {
        spinButton.addEventListener('click', toggleDrinkWheel);
    }
}
else {
    gameContainers.push(drinkWheelContainer);
}

if (typeof sectors === "undefined" || sectors === null) {
    var sectors = [
        { color: primaryColour, text: backgroundColour, label: "1 SIP" },
        { color: secondaryColour, text: backgroundColour, label: "2 SIPS" },
        { color: primaryColour, text: backgroundColour, label: "1 SIP" },
        { color: secondaryColour, text: backgroundColour, label: "3 SIPS" },
        { color: primaryColour, text: backgroundColour, label: "1 SIP" },
        { color: secondaryColour, text: backgroundColour, label: "4 SIPS" },
        { color: primaryColour, text: backgroundColour, label: "1 SIP" },
        { color: secondaryColour, text: backgroundColour, label: "2 SIPS" },
        { color: primaryColour, text: backgroundColour, label: "1 SIP" },
        { color: secondaryColour, text: backgroundColour, label: "3 SIPS" },
        { color: primaryColour, text: backgroundColour, label: "1 SIP" },
        { color: backgroundColour, text: primaryColour, label: "DOWN IT" }
    ];
}

const events = {
    listeners: {},
    addListener: function (eventName, fn) {
        this.listeners[eventName] = this.listeners[eventName] || [];
        this.listeners[eventName].push(fn);
    },
    fire: function (eventName, ...args) {
        if (this.listeners[eventName]) {
            for (let fn of this.listeners[eventName]) fn(...args);
        }
    }
};

const rand = (m, M) => Math.random() * (M - m) + m;

const spinEl = document.querySelector("#spin");
const ctx = document.querySelector("#wheel").getContext("2d");
const dia = ctx.canvas.width;
const rad = dia / 2;
const PI = Math.PI;
const TAU = 2 * PI;
const arc = TAU / sectors.length;

const friction = 0.97; // 0.995=soft, 0.99=mid, 0.98=hard
let angVel = 0; // Angular velocity
let ang = 0; // Angle in radians
let spinButtonClicked = false;

const getIndex = () => Math.floor(sectors.length - (ang / TAU) * sectors.length) % sectors.length;

function drawSector(sector, i) {
    const ang = arc * i;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = sector.color;
    ctx.moveTo(rad, rad);
    ctx.arc(rad, rad, rad, ang, ang + arc);
    ctx.lineTo(rad, rad);
    ctx.fill();

    ctx.translate(rad, rad);
    ctx.rotate(ang + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = sector.text;
    ctx.font = "bold 16px 'LemonMilk', sans-serif";
    ctx.fillText(sector.label, rad - 10, 10);
    ctx.restore();
}

function getCurrentPageColours() {
    const styles = getComputedStyle(document.documentElement);
    return {
        primary: styles.getPropertyValue('--primarypagecolour').trim(),
        secondary: styles.getPropertyValue('--secondarypagecolour').trim(),
        background: styles.getPropertyValue('--backgroundcolour').trim(),
        secondaryBackground: styles.getPropertyValue('--secondarybackgroundcolour').trim()
    };
}

function recolourSectorsFromCurrentTheme() {
    const { primary, secondary, background } = getCurrentPageColours();
    const downItIndex = sectors.length - 1;

    sectors.forEach((sector, index) => {
        if (index === downItIndex) {
            sector.color = background;
            sector.text = primary;
            return;
        }

        sector.color = index % 2 === 0 ? primary : secondary;
        sector.text = background;
    });
}

function redrawWheel() {
    ctx.clearRect(0, 0, dia, dia);
    sectors.forEach(drawSector);
    rotate();
}

function refreshWheelTheme() {
    recolourSectorsFromCurrentTheme();
    redrawWheel();

    if (!spinning) {
        const { primary, secondaryBackground } = getCurrentPageColours();
        spinEl.style.backgroundColor = primary;
        spinEl.style.color = secondaryBackground;
    }
}

function rotate() {
    const sector = sectors[getIndex()];
    ctx.canvas.style.transform = `rotate(${ang - PI / 2}rad)`;
    if (spinning) {
        spinEl.textContent = sector.label;
        spinEl.style.background = sector.color;
        spinEl.style.color = sector.text;
    }
}

function updateSpinHoverState() {
    const canSpin = !spinDisabled && !angVel;
    spinEl.classList.toggle('can-spin', canSpin);
}

function frame() {
    if (!angVel && spinButtonClicked) {
        const finalSector = sectors[getIndex()];
        events.fire("spinEnd", finalSector);
        spinButtonClicked = false;
        return;
    }

    angVel *= friction;
    if (angVel < 0.002) angVel = 0;
    ang += angVel;
    ang %= TAU;
    rotate();
}

function engine() {
    frame();
    requestAnimationFrame(engine);
}

function toggleDrinkWheel() {
    addElementIfNotExists(elementClassArray, drinkWheelContainer);
    spinDisabled = false;
    spinEl.textContent = 'SPIN';
    if (!drinkWheelContainer.classList.contains('active')) {
        drinkWheelContainer.classList.add('active');
        spinButton.classList.add('active');
        playSoundEffect('containerOpen');
        if (!overlay.classList.contains('active')) toggleOverlay(true);
    } else {
        drinkWheelContainer.classList.remove('active');
        spinButton.classList.remove('active');
        playSoundEffect('containerClose');
        if (findActiveElementsWithClasses(classArray).length === 0) toggleOverlay(false);
    }
}

function init() {
    refreshWheelTheme();
    engine();

    spinEl.textContent = 'SPIN';
    const { primary, secondaryBackground } = getCurrentPageColours();
    spinEl.style.backgroundColor = primary;
    spinEl.style.color = secondaryBackground;
    updateSpinHoverState();

    spinEl.addEventListener("click", () => {
        if (spinDisabled || angVel) return;
        angVel = rand(0.25, 0.45);
        spinButtonClicked = true;
        spinDisabled = true;
        spinning = true;
        updateSpinHoverState();
        playSoundEffect('wheelSpin');
    });
}

init();
document.addEventListener('page-colours-updated', refreshWheelTheme);

if (placeholderGamemodeAddons?.dataset.online === "true") {
    events.addListener("spinEnd", async (sector) => {
        spinning = false;

        const existingData = await getExistingPartyData(partyCode);
        const currentPartyData = existingData[0] || {};

        if (spinEl.textContent === "DOWN IT") {
            if (placeholderGamemodeAddons.dataset.gamemode === "paranoia") {
                completePunishmentText.textContent = "In order to find out the question you have to down your drink.";
            }
            else {
                completePunishmentText.textContent = "Down your drink!";
            }

            completePunishmentContainer.setAttribute("punishment-type", "DOWN-IT");
        } else {
            if (placeholderGamemodeAddons.dataset.gamemode === "paranoia") {
                completePunishmentText.textContent = "In order to find out the question you have to take " + spinEl.textContent;
            }
            else {
                completePunishmentText.textContent = "Take " + spinEl.textContent;
            }
            completePunishmentContainer.setAttribute("punishment-type", spinEl.textContent.replace(/\s+/g, '-'));
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        await SendInstruction({
            instruction: "DISPLAY_PUNISHMENT_TO_USER:" + (spinEl.textContent).replace(/\s+/g, "_").toUpperCase() + ":" + deviceId,
            byPassHost: true
        });

        spinDisabled = false;
        updateSpinHoverState();
    });
} else {
    events.addListener("spinEnd", (sector) => {
        spinning = false;
        updateSpinHoverState();
    });
}

waitForFunction("loadSound", () => {
    async function LoadDrinkWheelSoundEffects() {
        const soundEffects = {
            wheelSpin: '/sounds/party-games/wheel-spin.wav'
        };

        for (const [key, url] of Object.entries(soundEffects)) {
            await loadSound(key, url);
        }
    }

    (async () => {
        await LoadDrinkWheelSoundEffects();
    })();
});
