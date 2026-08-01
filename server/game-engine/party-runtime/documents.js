function cloneSerializable(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function getPartyConfigDoc(party) {
  if (!party.config || typeof party.config !== 'object') {
    party.config = {};
  }
  return party.config;
}

function getPartyStateDoc(party) {
  if (!party.state || typeof party.state !== 'object') {
    party.state = {};
  }
  return party.state;
}

function getPartyDeckDoc(party, { hasDeck = true } = {}) {
  if (!hasDeck) return null;
  if (!party.deck || typeof party.deck !== 'object') {
    party.deck = {};
  }
  return party.deck;
}

function getPartyPlayersDoc(party) {
  if (!Array.isArray(party.players)) {
    party.players = [];
  }
  return party.players;
}

module.exports = {
  cloneSerializable,
  getPartyConfigDoc,
  getPartyStateDoc,
  getPartyDeckDoc,
  getPartyPlayersDoc
};
