let phaseOne;
let phaseTwo;
let phaseThree;

const maxNumOfPhases = 3;
const maxNumOfDialogues = 3;

const phaseOptions = ["no-hint", "small-hint", "advance"];

let phaseOutcomes = [
  [0, 2, 2],
  [0, 0, 2],
  [2, 0, 0],
];

let phaseOutcomes2 = [
  [2, 2, 2],
  [2, 2, 2],
  [2, 2, 2],
];

const dialogueDelay = 4000;

gameContainers.push(selectCivilianWatchContainer, displayCivilianWatchResponseContainer);
