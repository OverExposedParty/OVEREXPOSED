function SetOverexpossureTags() {
    document.querySelectorAll('.tag-item').forEach(tagItem => {
        const primaryColour = tagItem.getAttribute('data-primary');
        const secondaryColour = tagItem.getAttribute('data-secondary');

        if (!tagItem.classList.contains('selected')) {
            updateTagStyles({
                tagElement: tagItem,
                state: 'not-selected',
                primaryColour: primaryColour,
                secondaryColour: secondaryColour
            });
        }
        else {
            updateTagStyles({
                tagElement: tagItem,
                state: 'selected',
                primaryColour: primaryColour,
                secondaryColour: secondaryColour
            });
        }

        tagItem.addEventListener('mouseover', () => {
            updateTagStyles({
                tagElement: tagItem,
                state: 'hovered',
                primaryColour: primaryColour,
                secondaryColour: secondaryColour
            });
        });

        tagItem.addEventListener('mouseout', () => {
            if (tagItem.classList.contains('selected')) {
                updateTagStyles({
                    tagElement: tagItem,
                    state: 'selected',
                    primaryColour: primaryColour,
                    secondaryColour: secondaryColour
                });
            }
            else {
                updateTagStyles({
                    tagElement: tagItem,
                    state: 'not-selected',
                    primaryColour: primaryColour,
                    secondaryColour: secondaryColour
                });
            }
        });

        tagItem.addEventListener('click', () => {
            ToggleSelectedTag(tagItem);
        });
    });
}

function ToggleSelectedTag(tagItem = document.querySelector(`.tag-item#confessions`)) {
    if (!tagItem) return;
    const tagItemText = tagItem.querySelector('.tag-text');
    const tagItemButton = tagItem.querySelector('button');

    const primaryColour = tagItem.getAttribute('data-primary');
    const secondaryColour = tagItem.getAttribute('data-secondary');
    tagItem.classList.add('selected');
    const selectedCard = document.querySelector(`.floating-button[data-id="${overexposureContainer.getAttribute('data-selected-card')}"]`);

    if (selectedCard && selectedCard.classList.contains('draft') == true) {
        selectedCard.setAttribute('data-tag', tagItem.id);
        selectedCard.querySelector('.card-type-text').textContent = tagItemText.textContent;
        selectedCard.querySelector('.card-type-text').style.color = primaryColour;
        selectedCard.querySelector('.button-text').style.color = primaryColour;
        selectedCard.querySelector('img').src = blankCard[tagItem.id] || blankCard["confessions"];
    }

    ChangePageColour(primaryColour, secondaryColour);

    document.querySelectorAll('.tag-item.selected').forEach(otherTag => {
        if (otherTag !== tagItem) {
            otherTag.classList.remove('selected');
            const otherButton = otherTag.querySelector('button');
            const otherPrimary = otherTag.getAttribute('data-primary');

            updateTagStyles({
                tagElement: otherTag,
                state: 'not-selected',
                primaryColour: otherPrimary,
                secondaryColour: secondaryColour
            });
        }
    });

    if (tagItem.classList.contains('selected')) {
        updateTagStyles({
            tagElement: tagItem,
            state: 'selected',
            primaryColour: primaryColour,
            secondaryColour: secondaryColour
        });
    }
}
function updateTagStyles({
    tagElement = null,
    state = 'not-selected',   // 'selected', 'not-selected', 'hovered'
    primaryColour = null,
    secondaryColour = null
}) {
    if (!tagElement) return;

    const tagText = tagElement.querySelector('.tag-text');
    const tagButton = tagElement.querySelector('button');

    switch (state) {
        case 'selected':
            tagText.style.color = primaryColour;
            tagButton.style.backgroundColor = primaryColour;
            tagButton.style.border = `4px solid ${primaryColour}`;
            break;

        case 'hovered':
            tagText.style.color = secondaryColour;
            tagButton.style.backgroundColor = secondaryColour;
            tagButton.style.border = `4px solid ${secondaryColour}`;
            break;

        case 'not-selected':
        default:
            tagText.style.color = primaryColour;
            tagButton.style.backgroundColor = 'var(--backgroundcolour)';
            tagButton.style.border = `4px solid ${primaryColour}`;
            break;
    }
}

SetOverexpossureTags();