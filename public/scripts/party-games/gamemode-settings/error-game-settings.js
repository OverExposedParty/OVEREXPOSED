document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.error-box').forEach(errorBoxButton => {
        errorBoxButton.querySelector('.drawer-button').addEventListener('click', () => {
            errorBoxButton.classList.toggle('hidden');
            if (errorBoxButton.classList.contains('hidden')) {
                errorBoxButton.querySelector('.drawer-button').textContent = "<";
            }
        });

        errorBoxButton.querySelector('.drawer-button').addEventListener('mouseenter', () => {
            if (!errorBoxButton.classList.contains('hidden')) {
                errorBoxButton.querySelector('.drawer-button').textContent = ">";
            }
        });

        errorBoxButton.querySelector('.drawer-button').addEventListener('mouseleave', () => {
            if (!errorBoxButton.classList.contains('hidden')) {
                errorBoxButton.querySelector('.drawer-button').textContent = "<";
            }
        });
    });
});

function CheckErrors() {
    const errorBoxes = document.querySelectorAll('.error-container .error-box');
    return !Array.from(errorBoxes).some(box => box.classList.contains('active'));
}
