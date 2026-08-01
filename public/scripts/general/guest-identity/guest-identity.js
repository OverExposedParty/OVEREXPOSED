const OE_GUEST_USERNAME_STORAGE_KEY = 'oe-guest-username';
const OE_LEGACY_PARTY_GUEST_USERNAME_STORAGE_KEY = 'oe-online-guest-username';
const OE_GUEST_USERNAME_PATTERN = /^OE\d{8}$/;

function createOeGuestUsername() {
  const values = new Uint32Array(8);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
  } else {
    values.forEach((_, index) => {
      values[index] = Math.floor(Math.random() * 0xffffffff);
    });
  }

  return `OE${Array.from(values, (value) => value % 10).join('')}`;
}

function getOrCreateOeGuestUsername() {
  const existing = localStorage.getItem(OE_GUEST_USERNAME_STORAGE_KEY);
  if (OE_GUEST_USERNAME_PATTERN.test(existing || '')) {
    return existing;
  }

  const legacy = localStorage.getItem(OE_LEGACY_PARTY_GUEST_USERNAME_STORAGE_KEY);
  if (OE_GUEST_USERNAME_PATTERN.test(legacy || '')) {
    localStorage.setItem(OE_GUEST_USERNAME_STORAGE_KEY, legacy);
    return legacy;
  }

  const username = createOeGuestUsername();
  localStorage.setItem(OE_GUEST_USERNAME_STORAGE_KEY, username);
  return username;
}

function getOeGuestDisplayName() {
  return getOrCreateOeGuestUsername();
}

window.createOeGuestUsername = createOeGuestUsername;
window.getOrCreateOeGuestUsername = getOrCreateOeGuestUsername;
window.getOeGuestDisplayName = getOeGuestDisplayName;
