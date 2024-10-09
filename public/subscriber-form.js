let subscriptionScript = 'https://script.google.com/macros/s/AKfycbzafvfvjkCl9nNFQmW24-nBThwe_pW8fkfrKA_ycr2F-0V5IH-Rrmyeh_I8KegszJbm/exec'; //https://script.google.com/macros/s/AKfycbzSq2HzlVl2C--D1JK9JPitdDSd0vFzvaJRs2W_N_YfatJJML9oLh8QfrVQraWhTd-2/exec
document.getElementById('emailForm').addEventListener('submit', function (e) {
    e.preventDefault(); // Prevent the default form submission

    var email = document.getElementById('email').value; // Get the email from the form

    // Send the form data using fetch API (AJAX)
    fetch(subscriptionScript, {
        method: 'POST',
        body: new URLSearchParams({
            'email': email
        })
    })
        .then(response => response.text())
        .then(data => {
            // Handle the response data (optional)
            alert('Thank you for subscribing!');
            document.getElementById('email').value = ''; // Clear the input field
        })
        .catch(error => {
            console.error('Error:', error);
            alert('There was an error submitting your email.');
        });
});