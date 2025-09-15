const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '/css/other/other-page.css';
document.head.appendChild(link);

const mainContainer = document.querySelector('.main-container');

fetch(`/json-files/other/${mainContainer.dataset.template}.json`)
    .then(response => response.json())
    .then(sections => {
        sections.forEach(section => {
            CreateNewSection(mainContainer, section);
        });
    }).then(() => {
        SetTextContainerToggle();
        waitForFunction("FetchHelpContainer", () => {
            FetchHelpContainer(`other/${mainContainer.dataset.template}.json`);
        });
    }).then(() => {
        SetScriptLoaded('/scripts/other/other-page-format.js');
    });

function CreateNewSection(container, section) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'section-container';
    sectionDiv.id = section.sectionID;

    const subHeadingDiv = document.createElement('div');
    subHeadingDiv.className = 'sub-heading';

    const h2 = document.createElement('h2');
    h2.textContent = section.subHeading;

    const dropDown = document.createElement('button');
    dropDown.className = 'drop-down';
    dropDown.textContent = '^';

    subHeadingDiv.appendChild(h2);
    subHeadingDiv.appendChild(dropDown);

    const textDiv = document.createElement('div');
    textDiv.className = 'text-container';

    const p = document.createElement('p');
    p.innerHTML = section.text;

    textDiv.appendChild(p);

    sectionDiv.appendChild(subHeadingDiv);
    sectionDiv.appendChild(textDiv);

    container.appendChild(sectionDiv);
}

function SetTextContainerToggle() {
    const textContainers = document.querySelectorAll('.text-container');
    textContainers.forEach(container => {
        const section = container.parentElement;
        const subHeadingContainer = section.querySelector('.sub-heading');
        const dropDownButton = section.querySelector('.drop-down');

        subHeadingContainer.addEventListener('click', () => {
            if (container.classList.contains('active')) {
                container.style.height = container.scrollHeight + 'px';
                container.offsetHeight;
                container.style.height = '0';
                container.classList.remove('active');
                dropDownButton.classList.remove('active');
            }
            else {
                container.classList.add('active');
                dropDownButton.classList.add('active');
                container.style.height = container.scrollHeight + 'px';
            }
        });
        container.addEventListener('transitionend', () => {
            if (container.classList.contains('active')) {
                container.style.height = 'auto';
            }
        });
    });
}