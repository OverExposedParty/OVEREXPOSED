let allQuestions = [];
let currentQuestionIndex = 0;
let questionPackMap = []; // Maps questions to their respective packs
let cardPackMap = []; // Maps cards to their respective packs

let numberOfQuestions = 0;
let numberOfTruthQuestions = 0;
let numberOfDareQuestions = 0;

async function loadJSONFiles(fetchPacks = null, seedShuffle = null) {
    try {
        const packsResponse = await fetch(`/json-files/party-games/packs/${gamemode}.json`);
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
                    const key = `${gamemode}-${pack["pack-name"]}`;
                    return localStorage.getItem(key) === 'true';
                })
                .map(pack => pack["pack-path"]);
        } else {
            // Use provided comma-separated string to determine packs to fetch
            const fetchPackList = fetchPacks.split(',').filter(Boolean); // remove empty entries

            filesToFetch = packs
                .filter(pack => {
                    const key = `${gamemode}-${pack["pack-name"]}`;
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
            const packName = pack["pack-name"].replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
            const packCard = pack["pack-card"];
            const packColour = pack["pack-colour"];
            cardPackMap.push({ packName, packCard, packColour });
        });
        if (gamemode == "Truth Or Dare") {
            if (localStorage.getItem(`${gamemode}-punishment`)) {
                allQuestions.push("punishment");
            }
        }
        if (allQuestions.length > 0) {
            if (seedShuffle) {
                shuffleQuestions(seedShuffle);
            }
            else {
                shuffleQuestions();
            }
            console.log(allQuestions);
            console.log(questionPackMap);
            console.log(cardPackMap);

            numberOfTruthQuestions = allQuestions.filter(q => q["question-type"] === "truth").length;
            numberOfDareQuestions = allQuestions.filter(q => q["question-type"] === "dare").length;

            console.log(`Number of truth questions: ${numberOfTruthQuestions}`);
            console.log(`Number of dare questions: ${numberOfDareQuestions}`);

        } else {
            console.error('No questions available to shuffle.');
            window.location.href = addSettingsExtensionToCurrentURL();
        }
        numberOfQuestions = allQuestions.length;
        console.log(`Loaded ${numberOfQuestions} questions`);
        SetScriptLoaded('/scripts/party-games/general/load-questions.js');
    }
    catch (error) {
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

        return function () {
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

function getNextQuestion(index = null, questionType = null, seed = null) {
    let selectedQuestion;
    let cardType;
    let filteredQuestions = allQuestions;
    if (questionType !== null) {
        filteredQuestions = allQuestions.filter(q => q["question-type"] === questionType);
    }
    if (index == null) {
        if (currentQuestionIndex >= filteredQuestions.length) {
            shuffleQuestions();
            currentQuestionIndex = 0;
        }
        selectedQuestion = filteredQuestions[currentQuestionIndex];
        cardType = questionPackMap[currentQuestionIndex] || 'Unknown Pack';

        currentQuestionIndex++;
    }
    else {
        selectedQuestion = filteredQuestions[index];
        cardType = questionPackMap[index] || 'Unknown Pack';
    }


    return { question: selectedQuestion['question'], cardType: cardType };
}