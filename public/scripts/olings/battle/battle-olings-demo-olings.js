(function () {
  function getOlingBattleDemoOlings() {
    const fakePlayerOlings = [
        {
          id: 'mossy',
          name: 'Mossy',
          energy: 100,
          level: 8,
          maxHealth: 118,
          type: 'Verdant',
          rarity: 'Base',
          personality: 'Steady',
          matchingSet: 'Moss Grove',
          style: 'Support',
          trait: 'Calm Guard',
          description:
            'Mossy keeps calm under pressure and slowly turns small openings into safe wins.',
          layers: {
            flight: 'Moss Wings',
            body: 'Moss Body',
            eyes: 'Moss Eyes',
            mouth: 'Moss Mouth'
          },
          flightType: 'wings',
          flightMotion: 'flutter',
          flightSpeed: 1,
          flight: '/images/olings/builds/flight/base/moss-wings.svg',
          body: '/images/olings/builds/body/base/moss-body.svg',
          eyes: '/images/olings/builds/eyes/base/moss-eyes.svg',
          mouth: '/images/olings/builds/mouth/base/moss-mouth.svg'
        },
        {
          id: 'pebble',
          name: 'Pebble',
          energy: 84,
          level: 6,
          maxHealth: 132,
          type: 'Stone',
          rarity: 'Base',
          personality: 'Stubborn',
          matchingSet: 'Stone Shell',
          style: 'Guard',
          trait: 'Heavy Brace',
          description:
            'Pebble is heavy, patient, and built to soak up hits before answering back.',
          layers: {
            flight: 'Stone Wings',
            body: 'Stone Body',
            eyes: 'Stone Eyes',
            mouth: 'Stone Mouth'
          },
          flightType: 'wings',
          flightMotion: 'flutter',
          flightSpeed: 1,
          flight: '/images/olings/builds/flight/base/stone-wings.svg',
          body: '/images/olings/builds/body/base/stone-body.svg',
          eyes: '/images/olings/builds/eyes/base/stone-eyes.svg',
          mouth: '/images/olings/builds/mouth/base/stone-mouth.svg'
        },
        {
          id: 'ember',
          name: 'Ember',
          energy: 72,
          level: 9,
          maxHealth: 104,
          type: 'Magma',
          rarity: 'Base',
          personality: 'Heated',
          matchingSet: 'Magma Core',
          style: 'Burst',
          trait: 'Pressure Spark',
          description:
            'Ember likes quick pressure and saves its biggest spark for wounded rivals.',
          layers: {
            flight: 'Magma Wings',
            body: 'Magma Body',
            eyes: 'Magma Eyes',
            mouth: 'Magma Mouth'
          },
          flightType: 'wings',
          flightMotion: 'flutter',
          flightSpeed: 1,
          flight: '/images/olings/builds/flight/base/magma-wings.svg',
          body: '/images/olings/builds/body/base/magma-body.svg',
          eyes: '/images/olings/builds/eyes/base/magma-eyes.svg',
          mouth: '/images/olings/builds/mouth/base/magma-mouth.svg'
        },
        {
          id: 'scrap',
          name: 'Scrap',
          energy: 63,
          level: 5,
          maxHealth: 96,
          type: 'Trash',
          rarity: 'Base',
          personality: 'Scrappy',
          matchingSet: 'Trash Balloon',
          style: 'Trick',
          trait: 'Messy Drift',
          description:
            'Scrap fights messy, floats awkwardly, and somehow makes that everyone else’s problem.',
          layers: {
            flight: 'Balloons',
            body: 'Trash Body',
            eyes: 'Trash Eyes',
            mouth: 'Trash Mouth'
          },
          flightType: 'balloons',
          flightMotion: 'sway',
          flightSpeed: 1,
          flight: '/images/olings/builds/flight/base/balloons.svg',
          body: '/images/olings/builds/body/base/trash-body.svg',
          eyes: '/images/olings/builds/eyes/base/trash-eyes.svg',
          mouth: '/images/olings/builds/mouth/base/trash-mouth.svg'
        },
        {
          id: 'fang',
          name: 'Fang',
          energy: 91,
          level: 10,
          maxHealth: 108,
          type: 'Vampire',
          rarity: 'Base',
          personality: 'Sharp',
          matchingSet: 'Night Bite',
          style: 'Drain',
          trait: 'Momentum Leech',
          description:
            'Fang waits for a clean angle, then bites into momentum and refuses to let go.',
          layers: {
            flight: 'Vampire Wings',
            body: 'Vampire Body',
            eyes: 'Vampire Eyes',
            mouth: 'Vampire Mouth'
          },
          flightType: 'wings',
          flightMotion: 'flutter',
          flightSpeed: 1,
          flight: '/images/olings/builds/flight/base/vampire-wings.svg',
          body: '/images/olings/builds/body/base/vampire-body.svg',
          eyes: '/images/olings/builds/eyes/base/vampire-eyes.svg',
          mouth: '/images/olings/builds/mouth/base/vampire-mouth.svg'
        }
      ];
    return fakePlayerOlings;
  }

  window.getOlingBattleDemoOlings = getOlingBattleDemoOlings;
})();
