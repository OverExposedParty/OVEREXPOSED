let spinning = false;

const rootStyles = getComputedStyle(document.documentElement);

const primaryColour = rootStyles.getPropertyValue('--primarypagecolour').trim();
const secondaryColour = rootStyles.getPropertyValue('--secondarypagecolour').trim();

const backgroundColour = rootStyles.getPropertyValue('--backgroundcolour').trim();
const secondaryBackgroundColour = rootStyles.getPropertyValue('--secondarybackgroundcolour').trim();
const warningColour = rootStyles.getPropertyValue('--warningcolour').trim();

const spinButton = document.getElementById('spin-button');

const soundWheelSpin = new Audio('/sounds/party-games/wheel-spin.wav');
soundWheelSpin.preload = 'auto';

if(spinButton){
    spinButton.addEventListener('click', toggleSpinTheWheel);
}

function toggleSpinTheWheel() {
    addElementIfNotExists(elementClassArray, spinContainer);
    spinDisabled = false;
    spinEl.textContent = 'SPIN';
    if (!spinContainer.classList.contains('active')) {
        spinContainer.classList.add('active');
        spinButton.classList.add('active');
        playSoundEffect(soundContainerOpen);
        if (!overlay.classList.contains('active')) {
            overlay.classList.add('active');
        }
    }
    else {
        spinContainer.classList.remove('active');
        playSoundEffect(soundContainerClose);
        if (findActiveElementsWithClasses(classArray).length == 0) {
            overlay.classList.remove('active');
        }
    }
}

const sectors = [
    { color: primaryColour, text: backgroundColour, label: "1 sip" },
    { color: secondaryColour, text: backgroundColour, label: "2 sips" },
    { color: primaryColour, text: backgroundColour, label: "1 sip" },
    { color: secondaryColour, text: backgroundColour, label: "3 sips" },
    { color: primaryColour, text: backgroundColour, label: "1 sip" },
    { color: secondaryColour, text: backgroundColour, label: "4 sips" },
    { color: primaryColour, text: backgroundColour, label: "1 sip" },
    { color: secondaryColour, text: backgroundColour, label: "2 sips" },
    { color: primaryColour, text: backgroundColour, label: "1 sip" },
    { color: secondaryColour, text: backgroundColour, label: "3 sips" },
    { color: primaryColour, text: backgroundColour, label: "1 sip" },
    { color: backgroundColour, text: primaryColour, label: "Down it" }
];

const events = {
    listeners: {},
    addListener: function (eventName, fn) {
        this.listeners[eventName] = this.listeners[eventName] || [];
        this.listeners[eventName].push(fn);
    },
    fire: function (eventName, ...args) {
        if (this.listeners[eventName]) {
            for (let fn of this.listeners[eventName]) {
                fn(...args);
            }
        }
    },
};

const rand = (m, M) => Math.random() * (M - m) + m;
const tot = sectors.length;
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
let spinDisabled = false;

const getIndex = () => Math.floor(tot - (ang / TAU) * tot) % tot;

function drawSector(sector, i) {
    const ang = arc * i;
    ctx.save();

    // COLOR
    ctx.beginPath();
    ctx.fillStyle = sector.color;
    ctx.moveTo(rad, rad);
    ctx.arc(rad, rad, rad, ang, ang + arc);
    ctx.lineTo(rad, rad);
    ctx.fill();

    // TEXT
    ctx.translate(rad, rad);
    ctx.rotate(ang + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = sector.text;
    ctx.font = "bold 16px 'LemonMilk', sans-serif";
    ctx.fillText(sector.label, rad - 10, 10);
    //

    ctx.restore();
}

function rotate() {
    const sector = sectors[getIndex()];
    ctx.canvas.style.transform = `rotate(${ang - PI / 2}rad)`;
    if (spinning == true) {
        spinEl.textContent = sector.label;
        spinEl.style.background = sector.color;
        spinEl.style.color = sector.text;
    }
}

function frame() {
    // Fire an event after the wheel has stopped spinning
    if (!angVel && spinButtonClicked) {
        const finalSector = sectors[getIndex()];
        events.fire("spinEnd", finalSector);
        spinButtonClicked = false;
        return;
    }

    angVel *= friction; // Decrement velocity by friction
    if (angVel < 0.002) angVel = 0; // Bring to stop
    ang += angVel; // Update angle
    ang %= TAU; // Normalize angle
    rotate();
}

function engine() {
    frame();
    requestAnimationFrame(engine);
}

function init() {
    sectors.forEach(drawSector);
    rotate(); // Initial rotation
    engine(); // Start engine

    spinEl.textContent = 'SPIN';
    spinEl.style.backgroundColor = 'var(--primarypagecolour)';
    spinEl.style.color = 'var(--secondarybackgroundcolour)';

    spinEl.addEventListener("click", () => {
        if (spinDisabled || angVel) return; // If spinning is disabled or currently spinning, do nothing

        angVel = rand(0.25, 0.45); // Set the spin velocity
        spinButtonClicked = true; // Flag to indicate spin started
        spinDisabled = true;
        spinning = true;
        playSoundEffect(soundWheelSpin);
    });
}

init();

events.addListener("spinEnd", (sector) => {
    spinning = false;
});