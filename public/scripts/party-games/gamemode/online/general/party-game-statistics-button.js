(function () {
    const BUTTON_ID = 'party-game-statistics-button';
    const TOGGLE_EVENT = 'oe-party-game-statistics-toggle';

    function getGamemode() {
        return (
            document.getElementById('placeholder-card-container')?.dataset?.gamemode ||
            (typeof gamemode !== 'undefined' ? gamemode : '')
        );
    }

    function createStatisticsIcon() {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 485 485');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Statistics Icon');

        const rootGroup = document.createElementNS(svgNS, 'g');
        const group = document.createElementNS(svgNS, 'g');

        const outerCircle = document.createElementNS(svgNS, 'circle');
        outerCircle.setAttribute('cx', '242.5');
        outerCircle.setAttribute('cy', '242.5');
        outerCircle.setAttribute('r', '225');
        outerCircle.setAttribute('fill', '#1f1f1f');
        outerCircle.setAttribute('stroke', 'var(--primarypagecolour)');
        outerCircle.setAttribute('stroke-miterlimit', '10');
        outerCircle.setAttribute('stroke-width', '35px');

        [
            ['130', '205', '75', '100', 'var(--secondarypagecolour)'],
            ['205', '180', '75', '125', 'var(--primarypagecolour)'],
            ['280', '230', '75', '75', 'var(--secondarypagecolour)']
        ].forEach(([x, y, width, height, fill]) => {
            const bar = document.createElementNS(svgNS, 'rect');
            bar.setAttribute('x', x);
            bar.setAttribute('y', y);
            bar.setAttribute('width', width);
            bar.setAttribute('height', height);
            bar.setAttribute('fill', fill);
            group.appendChild(bar);
        });

        rootGroup.appendChild(outerCircle);
        rootGroup.appendChild(group);
        svg.appendChild(rootGroup);
        return svg;
    }

    function ensureButton() {
        let button = document.getElementById(BUTTON_ID);
        if (button) return button;

        button = document.createElement('button');
        button.id = BUTTON_ID;
        button.type = 'button';
        button.className = 'party-game-statistics-button';
        button.dataset.gamemode = getGamemode();
        button.dataset.statisticsToggleReady = 'true';
        button.setAttribute('aria-label', 'Open party game statistics');
        button.title = 'Party game statistics';
        Object.assign(button.style, {
            all: 'unset',
            bottom: '10px',
            cursor: 'pointer',
            left: '10px',
            position: 'fixed',
            zIndex: '300'
        });

        button.appendChild(createStatisticsIcon());
        button.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
        });

        document.body.appendChild(button);
        return button;
    }

    if (document.body) {
        ensureButton();
    } else {
        document.addEventListener('DOMContentLoaded', ensureButton, { once: true });
    }
})();
