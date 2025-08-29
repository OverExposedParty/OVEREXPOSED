function CheckUsernameIsValid(username) {
    const isValidCharacters = /^[A-Z0-9_]+$/.test(username);

    if (username === '') {
        console.log('Username is empty');
        return false;
    }
    if (username.length > usernameMaxLength) {
        console.log('Username is too long');
        return false;
    }
    if (!isValidCharacters) {
        console.log('Username must not contain spaces or special characters');
        return false;
    }
    return true;
}

function isValidString(str) {
    return /^[A-Za-z0-9_]+$/.test(str);
}