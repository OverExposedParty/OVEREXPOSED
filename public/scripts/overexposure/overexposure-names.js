let nameList = new Set();

async function loadNames() {
    try {
        const response = await fetch("/json-files/names.json");
        const data = await response.json();
        nameList = new Set(data.map(name => name.toLowerCase()));
    } catch (error) {
        console.error("Error loading names:", error);
    }
}

function detectName(text) {
    let doc = nlp(text);
    let detectedNames = doc.people().out('array');
    detectedNames = detectedNames.filter(name => /^[A-Za-z]+$/.test(name));

    return detectedNames.length > 0 ? { hasName: true, name: detectedNames } : { hasName: false, name: null };
}
contentsTextArea.addEventListener("input", function () {
    const cursorPosition = this.selectionStart;
    this.setSelectionRange(cursorPosition, cursorPosition);
});

loadNames();