if (typeof sectors === "undefined" || sectors === null) {
  var sectors = [
    { color: primaryColour, text: backgroundColour, label: "2 SIPS" },
    { color: secondaryColour, text: backgroundColour, label: "4 SIPS" },
    { color: primaryColour, text: backgroundColour, label: "2 SIPS" },
    { color: secondaryColour, text: backgroundColour, label: "1 SHOT" },
    { color: primaryColour, text: backgroundColour, label: "2 SIPS" },
    { color: secondaryColour, text: backgroundColour, label: "2 SHOTS" },
    { color: primaryColour, text: backgroundColour, label: "2 SIPS" },
    { color: secondaryColour, text: backgroundColour, label: "4 SIPS" },
    { color: primaryColour, text: backgroundColour, label: "2 SIPS" },
    { color: secondaryColour, text: backgroundColour, label: "1 SHOT" },
    { color: primaryColour, text: backgroundColour, label: "2 SIP" },
    { color: backgroundColour, text: primaryColour, label: "DOWN IT" }
  ];
}

const gamemodeAddonDrinkWheelScript = document.createElement('script');
gamemodeAddonDrinkWheelScript.src = `/scripts/party-games/gamemode/gamemode-addons/drink-wheel.js`;
document.body.appendChild(gamemodeAddonDrinkWheelScript);