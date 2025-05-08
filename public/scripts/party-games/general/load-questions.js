let allQuestions = [];
let currentQuestionIndex = 0;
let questionPackMap = []; // Maps questions to their respective packs
let cardPackMap = []; // Maps cards to their respective packs

async function loadJSONFiles(fetchPacks = null, seedShuffle = null) {
    try {
        const packsResponse = await fetch(`/json-files/${gamemode}-packs.json`);
        if (!packsResponse.ok) {
            console.error(`Failed to fetch packs: ${packsResponse.statusText}`);
            return;
        }

        const packsData = await packsResponse.json();
        const packs = packsData[`${gamemode}-packs`];

        let filesToFetch = [];

        if (fetchPacks === null) {
            // Use localStorage to determine which packs to fetch
            filesToFetch = packs
                .filter(pack => {
                    const key = `${gamemode}-${pack["pack-name"].toLowerCase().replace(/\s+/g, '-')}`;
                    return localStorage.getItem(key) === 'true';
                })
                .map(pack => pack["pack-path"]);
        } else {
            // Use provided comma-separated string to determine packs to fetch
            const fetchPackList = fetchPacks.split(',').filter(Boolean); // remove empty entries

            filesToFetch = packs
                .filter(pack => {
                    const key = `${gamemode}-${pack["pack-name"].toLowerCase().replace(/\s+/g, '-')}`;
                    return fetchPackList.includes(key);
                })
                .map(pack => pack["pack-path"]);
        }

        console.log('Files to Fetch:', filesToFetch);

        const responses = await Promise.all(filesToFetch.map(file => fetch(file)));

        const questionsArrays = await Promise.all(
            responses.map(async response => {
                if (!response.ok) {
                    console.error(`Failed to fetch ${response.url}: ${response.statusText}`);
                    return {};
                }
                const data = await response.json();
                console.log('Fetched Data:', data);
                return data;
            })
        );

        questionsArrays.forEach((data, index) => {
            Object.keys(data).forEach(packName => {
                const questions = data[packName];
                if (Array.isArray(questions)) {
                    questions.forEach(question => {
                        allQuestions.push(question);
                        questionPackMap.push(packName.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()).replace(formattedGamemode, "").trim());
                    });
                } else {
                    console.error(`Expected an array of questions for pack: ${packName}, but received:`, questions);
                }
            });
        });

        packs.forEach(pack => {
            const packName = pack["pack-name"];
            const packCard = pack["pack-card"];
            const packColour = pack["pack-colour"];
            cardPackMap.push({ packName, packCard, packColour });
        });
        if(gamemode == "Truth Or Dare"){
            if (localStorage.getItem(`${gamemode}-punishment`)) {
                allQuestions.push("punishment");
            }
        }
        if (allQuestions.length > 0) {
            if(seedShuffle){
                shuffleQuestions(seedShuffle);
            }
            else{
                shuffleQuestions();
            }
            console.log(allQuestions);
            console.log(questionPackMap);
            console.log(cardPackMap);
        } else {
            console.error('No questions available to shuffle.');
            window.location.href = addSettingsExtensionToCurrentURL();
        }

    } catch (error) {
        console.error('Failed to load JSON files:', error);
    }
}

function shuffleQuestions(seed = null) {
    // Seedable random number generator (simple LCG)
    function seededRandom(seed) {
        let m = 0x80000000; // 2**31
        let a = 1103515245;
        let c = 12345;
        let state = seed ? seed : Math.floor(Math.random() * m);

        return function() {
            state = (a * state + c) % m;
            return state / m;
        };
    }

    const random = seed !== null ? seededRandom(seed) : Math.random;

    for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        [questionPackMap[i], questionPackMap[j]] = [questionPackMap[j], questionPackMap[i]];
    }
}

function getNextQuestion(index = null) {
    let selectedQuestion;
    let cardType;
    if(index == null){
        if (currentQuestionIndex >= allQuestions.length) {
            shuffleQuestions();
            currentQuestionIndex = 0;
        }
        selectedQuestion = allQuestions[currentQuestionIndex];
        cardType = questionPackMap[currentQuestionIndex] || 'Unknown Pack';
    
        currentQuestionIndex++;
    }
    else{
        selectedQuestion = allQuestions[index];
        cardType = questionPackMap[index] || 'Unknown Pack';
    }
    return { question: selectedQuestion['question'], cardType: cardType };
}
