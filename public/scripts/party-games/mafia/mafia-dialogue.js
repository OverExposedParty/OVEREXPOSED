const mafiaDisplayRoleTimer = 7500;
const displayPlayerKilledTimer = 7500;

const mafiaDialogueKill = ["[Player Name] was found dead last night.", 
    "The sun rises... and [Player Name] didn’t make it.",
    "[Player Name] was killed during the night.",
    "A lifeless body is discovered — it was [Player Name].",
    "Blood stains the ground — [Player Name] met a gruesome end."
];

const mafiaDialogueNoKill = ["It was a silent night."];

const mafiaRoleDescription = {
  mafioso: "You are part of the mafia. Work with your teammates to eliminate the civilians.",
  civilian: "You are a regular townsperson. Find and eliminate the mafia."
};

const nightPhaseDialogue = {
  mafioso: "You are part of the mafia. Work with your teammates to eliminate the civilians.",
  godfather: "You are part of the mafia. Work with your teammates to eliminate the civilians.",
  civilian: "You are a regular townsperson. Find and eliminate the mafia."
};

const mafiaDialogueTownVote = ["The town have spoken. [Player Name] has been kicked."];
const mafiaDialogueTownNoVote = ["The town could not come a decision. No one was kicked"];