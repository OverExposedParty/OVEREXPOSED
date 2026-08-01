let nameList = new Set();

const LEETSPEAK_MAP = {
    "0": "o",
    "1": "i",
    "2": "z",
    "3": "e",
    "4": "a",
    "5": "s",
    "6": "g",
    "7": "t",
    "8": "b",
    "9": "g",
    "@": "a",
    "$": "s",
    "!": "i",
    "|": "i"
};

async function loadNames() {
    try {
        const response = await fetch("/json-files/names.json");
        const data = await response.json();
        nameList = new Set(data.map(name => normalizeNameToken(name)));
    } catch (error) {
        console.error("Error loading names:", error);
    }
}

function normalizeNameToken(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/./g, char => LEETSPEAK_MAP[char] ?? char)
        .replace(/[^a-z]/g, "");
}

function collapseRepeatedLetters(value) {
    return value.replace(/([a-z])\1{1,}/g, "$1");
}

function countAlphaWords(value) {
    return (String(value || "").match(/[A-Za-z]+/g) || []).length;
}

function generateNameCandidates(text) {
    const sanitizedText = String(text || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/./g, char => LEETSPEAK_MAP[char] ?? char);

    const alphaChunks = sanitizedText.match(/[a-z]+/g) || [];

    return { alphaChunks };
}

function detectName(text) {
    const detectedNames = new Set();
    const { alphaChunks } = generateNameCandidates(text);

    for (let index = 0; index < alphaChunks.length - 1; index++) {
        const firstChunk = collapseRepeatedLetters(alphaChunks[index]);
        const secondChunk = collapseRepeatedLetters(alphaChunks[index + 1]);

        if (firstChunk.length < 3 || secondChunk.length < 3) continue;
        if (nameList.has(firstChunk) && nameList.has(secondChunk)) {
            detectedNames.add(`${firstChunk} ${secondChunk}`);
        }
    }

    if (detectedNames.size > 0) {
        return { hasName: true, name: Array.from(detectedNames) };
    }

    if (typeof nlp === "function") {
        const doc = nlp(text);
        const nlpNames = doc.people().out("array")
            .map(name => String(name || "").trim())
            .filter(name => countAlphaWords(name) >= 2)
            .map(name => normalizeNameToken(name))
            .filter(name => name.length >= 3 && nameList.has(name));

        if (nlpNames.length > 0) {
            return { hasName: true, name: nlpNames };
        }
    }

    return { hasName: false, name: null };
}

contentsTextArea.addEventListener("input", function () {
    const cursorPosition = this.selectionStart;
    this.setSelectionRange(cursorPosition, cursorPosition);
});

loadNames();
