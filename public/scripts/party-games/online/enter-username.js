function CheckUsernameIsValid(username) {
    const isValidCharacters = /^[A-Z0-9_]+$/.test(username);

    if (username === '') {
        debugLog('Username is empty');
        return false;
    }
    if (username.length > usernameMaxLength) {
        debugLog('Username is too long');
        return false;
    }
    if (!isValidCharacters) {
        debugLog('Username must not contain spaces or special characters');
        return false;
    }
    return true;
}

function isValidString(str) {
    return /^[A-Za-z0-9_]+$/.test(str);
}