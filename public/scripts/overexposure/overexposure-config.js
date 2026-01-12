let intervalId;

const canvasWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasWidth').trim(), 10);
const canvasHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--canvasHeight').trim(), 10);

const cardWidth = getComputedStyle(document.documentElement).getPropertyValue('--cardWidth');
const cardWidthValue = parseFloat(cardWidth);

const maxLength = parseInt(textInput.getAttribute("maxlength"), 10);

let count = 0;

const blankCard = {
    confessions: "/images/overexposure/card-templates/confessions.svg",
    stories: "/images/overexposure/card-templates/stories.svg",
    thoughts: "/images/overexposure/card-templates/thoughts.svg",
    feelings: "/images/overexposure/card-templates/feelings.svg"
};

const tagColours = {
    confessions: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--confessions-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--confessions-secondary-colour').trim()
    },
    stories: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--stories-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--stories-secondary-colour').trim()
    },
    thoughts: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--thoughts-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--thoughts-secondary-colour').trim()
    },
    feelings: {
        primary: getComputedStyle(document.documentElement).getPropertyValue('--feelings-primary-colour').trim(),
        secondary: getComputedStyle(document.documentElement).getPropertyValue('--feelings-secondary-colour').trim()
    }
};

let currentPageColours = {
    primary: '#FF6961',
    secondary: '#B74C57'
};