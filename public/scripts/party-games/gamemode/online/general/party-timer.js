let timeout;

function startTimer({ timeLeft = 0, duration = 0, selectedTimer = null }) {
    const timer = selectedTimer.querySelector('.timer');
    const mask = selectedTimer.querySelector('.mask');
    const timerWrapper = selectedTimer;
    let small = selectedTimer.classList.contains('small');
    let timerNumber;

    if (!small) {
        timerNumber = selectedTimer.querySelector('.timer-number');
        timerNumber.textContent = timeLeft;
    }

    if (timeLeft > duration) timeLeft = duration;
    if (timeLeft < 0) timeLeft = 0;

    timerWrapper.classList.add('active');

    let startTime = null;
    let remaining = timeLeft;

    selectedTimer._cancel = false;
    selectedTimer._requestId = null;
    selectedTimer._duration = duration; // store for reset
    selectedTimer._small = small;
    selectedTimer._timer = timer;
    selectedTimer._mask = mask;
    selectedTimer._timerNumber = timerNumber;

    function animate(timestamp) {
        if (selectedTimer._cancel) return;
        if (!startTime) startTime = timestamp;

        const elapsed = (timestamp - startTime) / 1000;
        const timePassed = duration - timeLeft + elapsed;
        const progress = Math.min(timePassed / duration, 1);
        const rotateDeg = 360 * progress;

        timer.style.transform = `rotate(${rotateDeg}deg)`;

        if (progress < 0.5) {
            const localProgress = progress / 0.5;
            const rotation = 0 + localProgress * (-179.8);
            mask.style.transform = `rotate(${rotation}deg)`;
            mask.style.background = getComputedStyle(document.documentElement)
                .getPropertyValue('--primarypagecolour').trim();
        } else {
            const localProgress = (progress - 0.5) / 0.5;
            const rotation = 0 + localProgress * (-180);
            mask.style.transform = `rotate(${rotation}deg)`;
            mask.style.background = getComputedStyle(document.documentElement)
                .getPropertyValue('--backgroundcolour').trim();
        }

        const newRemaining = Math.ceil(duration - timePassed);
        if (!small && newRemaining !== remaining && newRemaining >= 0) {
            remaining = newRemaining;
            timerNumber.textContent = remaining;
        }

        if (progress < 1 && !selectedTimer._cancel) {
            selectedTimer._requestId = requestAnimationFrame(animate);
        }
    }

    selectedTimer._requestId = requestAnimationFrame(animate);
}

function stopTimer(selectedTimer) {
    if (!selectedTimer) return;

    // cancel ongoing animation
    selectedTimer._cancel = true;
    if (selectedTimer._requestId) {
        cancelAnimationFrame(selectedTimer._requestId);
        selectedTimer._requestId = null;
    }

    const timer = selectedTimer._timer || selectedTimer.querySelector('.timer');
    const mask = selectedTimer._mask || selectedTimer.querySelector('.mask');
    const timerNumber = selectedTimer._timerNumber || selectedTimer.querySelector('.timer-number');
    const small = selectedTimer._small ?? selectedTimer.classList.contains('small');
    const duration = selectedTimer._duration || 0;

    // visually reset to full
    timer.style.transform = 'rotate(360deg)';
    mask.style.transform = 'rotate(-180deg)';
    mask.style.background = getComputedStyle(document.documentElement)
        .getPropertyValue('--backgroundcolour').trim();

    // reset number text
    if (!small && timerNumber) {
        timerNumber.textContent = duration;
    }

    // keep active state or not, depending on your preference
    selectedTimer.classList.add('active');
}

function createCancelableTimeout(ms) {
    let timeoutId;
    let rejectFn;
    let isFinished = false;

    const promise = new Promise((resolve, reject) => {
        rejectFn = reject;
        timeoutId = setTimeout(() => {
            isFinished = true;
            resolve();
        }, ms);
    });

    return {
        promise,
        cancel: () => {
            if (!isFinished && timeoutId != null) {
                clearTimeout(timeoutId);
                //rejectFn?.(new Error('Timeout canceled'));
                timeoutId = null;
            }
        }
    };
}

async function SetTimeOut({ delay = 0, instruction = null, nextDelay = null, clearIcons = false, newUserConfirmed = null, newUserReady = null, newUserVotes = null }) {
    if (deviceId != hostDeviceId || delay == null) return;

    if (timeout?.cancel) {
        timeout.cancel();
    }
    timeout = null;
    timeout = createCancelableTimeout(delay);
    try {
        await timeout.promise;
        if (clearIcons) {
            ClearIcons();
        }
        await SendInstruction({
            instruction: instruction,
            partyData: currentPartyData,
            timer: Date.now() + nextDelay,
            updateUsersConfirmation: newUserConfirmed,
            updateUsersReady: newUserReady,
            updateUsersVote: newUserVotes
        });
    } catch (err) {
        if (err.message === 'Timeout canceled') {
            return;
        } else {
            throw err;
        }
    }
}

function AddTimerToContainer(selectContainer) {
    if (!selectContainer) return;

    const timerWrapper = document.createElement('div');
    timerWrapper.className = 'timer-wrapper small';

    const timer = document.createElement('div');
    timer.className = 'timer';

    const mask = document.createElement('div');
    mask.className = 'mask';

    timer.appendChild(mask);
    timerWrapper.appendChild(timer);

    selectContainer.appendChild(timerWrapper);
}
